-- =============================================================================
-- Sprint 12 — Bilans intelligents (IA opt-in)
--
-- - public.ai_preferences  : consentement explicite (OFF par défaut) et catégories de
--                            données autorisées ; compteur quotidien de générations
-- - public.ai_reflections  : bilans générés (résultat utile seulement : jamais le prompt,
--                            le jeu de données envoyé ni la réponse brute du fournisseur)
-- - reserve_ai_generation(): réserve une génération (consentement actif + 3 / jour)
-- - save_ai_reflection()   : enregistre / remplace le bilan d'une période
-- Tout est supprimé avec le compte (ON DELETE CASCADE, ADR-077).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Préférences et consentement (une ligne par utilisateur)
-- -----------------------------------------------------------------------------
create table public.ai_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  ai_enabled boolean not null default false,
  include_reflections boolean not null default true,
  include_consumption_context boolean not null default false,
  include_craving_context boolean not null default false,
  -- Dernier consentement accordé (version du texte présenté) et dernière révocation.
  consented_at timestamptz,
  consent_version text,
  revoked_at timestamptz,
  -- Limite de générations : jamais modifiable par le client (RPC SECURITY DEFINER).
  generations_date date,
  generations_count smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ai_preferences_consent_version_length check (char_length(consent_version) between 1 and 20),
  constraint ai_preferences_enabled_requires_consent check (not ai_enabled or (consented_at is not null and consent_version is not null)),
  constraint ai_preferences_generations_range check (generations_count between 0 and 100)
);

create trigger ai_preferences_set_updated_at
  before update on public.ai_preferences
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Bilans générés
-- -----------------------------------------------------------------------------
create table public.ai_reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  type text not null default 'weekly',
  summary text not null,
  content jsonb not null,
  provider text,
  model text,
  prompt_version text not null,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint ai_reflections_type_valid check (type in ('weekly')),
  constraint ai_reflections_period_valid check (period_end >= period_start and period_end - period_start <= 31),
  constraint ai_reflections_summary_length check (char_length(summary) between 1 and 1200),
  constraint ai_reflections_content_object check (jsonb_typeof(content) = 'object' and pg_column_size(content) <= 32768),
  constraint ai_reflections_provider_length check (char_length(provider) <= 40 and char_length(model) <= 80),
  constraint ai_reflections_prompt_version_length check (char_length(prompt_version) between 1 and 40),
  -- Régénérer une même période REMPLACE le bilan (ADR-087).
  constraint ai_reflections_one_per_period unique (user_id, type, period_start, period_end)
);

create index ai_reflections_user_period_idx on public.ai_reflections (user_id, period_end desc);

-- -----------------------------------------------------------------------------
-- RPC (SECURITY DEFINER ciblées : aucune n'accepte de user_id ; auth.uid() seulement)
-- -----------------------------------------------------------------------------

/**
 * Réserve une génération AVANT l'appel au fournisseur : exige un consentement actif et
 * au plus 3 générations par journée UTC. Retourne le nombre restant.
 */
create or replace function public.reserve_ai_generation()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_prefs public.ai_preferences%rowtype;
  v_today date := (now() at time zone 'UTC')::date;
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_prefs from public.ai_preferences p where p.user_id = v_user_id for update;
  if not found or not v_prefs.ai_enabled then
    raise exception 'ai_consent_required' using errcode = '42501';
  end if;
  v_count := case when v_prefs.generations_date = v_today then v_prefs.generations_count else 0 end;
  if v_count >= 3 then
    raise exception 'ai_rate_limited' using errcode = 'P0001';
  end if;
  update public.ai_preferences
     set generations_date = v_today, generations_count = v_count + 1
   where user_id = v_user_id;
  return 3 - (v_count + 1);
end;
$$;

/**
 * Enregistre (ou remplace pour la même période) le bilan de l'utilisateur courant.
 * Exige un consentement actif. Le contenu est validé par l'application (Zod + garde-fous)
 * avant l'appel ; la base contrôle forme et tailles.
 */
create or replace function public.save_ai_reflection(
  p_period_start date,
  p_period_end date,
  p_summary text,
  p_content jsonb,
  p_provider text,
  p_model text,
  p_prompt_version text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from public.ai_preferences p where p.user_id = v_user_id and p.ai_enabled) then
    raise exception 'ai_consent_required' using errcode = '42501';
  end if;
  insert into public.ai_reflections (user_id, period_start, period_end, type, summary, content, provider, model, prompt_version, generated_at)
  values (v_user_id, p_period_start, p_period_end, 'weekly', btrim(p_summary), p_content, p_provider, p_model, p_prompt_version, now())
  on conflict (user_id, type, period_start, period_end) do update set
    summary = excluded.summary,
    content = excluded.content,
    provider = excluded.provider,
    model = excluded.model,
    prompt_version = excluded.prompt_version,
    generated_at = excluded.generated_at
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.reserve_ai_generation() from public, anon;
revoke execute on function public.save_ai_reflection(date, date, text, jsonb, text, text, text) from public, anon;
grant execute on function public.reserve_ai_generation() to authenticated;
grant execute on function public.save_ai_reflection(date, date, text, jsonb, text, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Privilèges et RLS
-- ai_preferences : lecture, création et modification des préférences seulement
--   (jamais les compteurs de génération).
-- ai_reflections : lecture et suppression ; écriture uniquement par save_ai_reflection().
-- -----------------------------------------------------------------------------
revoke all on table public.ai_preferences from anon, authenticated;
grant select on table public.ai_preferences to authenticated;
grant insert (user_id, ai_enabled, include_reflections, include_consumption_context, include_craving_context,
              consented_at, consent_version, revoked_at) on table public.ai_preferences to authenticated;
grant update (ai_enabled, include_reflections, include_consumption_context, include_craving_context,
              consented_at, consent_version, revoked_at) on table public.ai_preferences to authenticated;

revoke all on table public.ai_reflections from anon, authenticated;
grant select, delete on table public.ai_reflections to authenticated;

alter table public.ai_preferences enable row level security;
create policy "ai_preferences_select_own" on public.ai_preferences
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "ai_preferences_insert_own" on public.ai_preferences
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "ai_preferences_update_own" on public.ai_preferences
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.ai_reflections enable row level security;
create policy "ai_reflections_select_own" on public.ai_reflections
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "ai_reflections_delete_own" on public.ai_reflections
  for delete to authenticated using ((select auth.uid()) = user_id);
