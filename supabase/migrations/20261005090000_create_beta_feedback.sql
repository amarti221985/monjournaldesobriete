-- =============================================================================
-- Sprint 13 — Avis des bêta-testeurs (formulaire interne minimal)
--
-- Le message est écrit volontairement par l'utilisateur : aucune capture d'écran, aucune
-- copie automatique du journal. `page_context` = section choisie par l'utilisateur
-- (identifiant court, jamais une URL complète ni une date). Lecture par le propriétaire du
-- service depuis le tableau de bord Supabase. Supprimé avec le compte (CASCADE).
-- =============================================================================

create table public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null,
  message text not null,
  page_context text,
  created_at timestamptz not null default now(),

  constraint beta_feedback_category_valid check (category in ('bug', 'confusing', 'suggestion', 'like')),
  constraint beta_feedback_message_length check (char_length(btrim(message)) between 1 and 2000),
  constraint beta_feedback_page_context_valid check (
    page_context is null or page_context in (
      'today', 'checkin', 'calendar', 'journal', 'progress', 'craving', 'plan', 'achievements',
      'insights', 'settings', 'report', 'onboarding', 'other'
    )
  )
);

create index beta_feedback_user_created_idx on public.beta_feedback (user_id, created_at desc);

alter table public.beta_feedback enable row level security;

revoke all on table public.beta_feedback from anon, authenticated;
grant select on table public.beta_feedback to authenticated;
grant insert (user_id, category, message, page_context) on table public.beta_feedback to authenticated;

create policy "beta_feedback_select_own" on public.beta_feedback
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "beta_feedback_insert_own" on public.beta_feedback
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- Garde-fou contre l'envoi massif : 20 avis au plus par période de 24 heures.
create or replace function public.enforce_beta_feedback_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.beta_feedback f
       where f.user_id = new.user_id and f.created_at > now() - interval '24 hours') >= 20 then
    raise exception 'feedback_rate_limited' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_beta_feedback_rate() from public, anon, authenticated;

create trigger beta_feedback_rate_limit
  before insert on public.beta_feedback
  for each row execute function public.enforce_beta_feedback_rate();
