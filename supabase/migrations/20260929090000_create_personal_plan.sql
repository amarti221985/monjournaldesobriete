-- =============================================================================
-- Sprint 8 — Mon plan personnel
--
-- Réutilise les données de l'onboarding (user_substances, personal_reasons,
-- user_motivations, support_contacts) et ajoute :
-- - support_contacts.is_primary       : une personne principale au plus
-- - user_personal_triggers            : déclencheurs CHOISIS par l'utilisateur (≠ checkin_triggers)
-- - user_personal_strategies          : stratégies du plan (catalogue ou personnelles), 3 favoris max
-- - safe_places                       : lieux sûrs en texte libre (aucune géolocalisation), 3 favoris max
-- - personal_reminders                : un rappel principal
-- - self_letters                      : une lettre à soi-même
-- - RPC transactionnelles             : substance principale, ajout / arrêt du suivi,
--                                       motivations, personne principale
-- Le plan est choisi par l'utilisateur : aucune donnée n'y est ajoutée automatiquement (ADR-064).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Limite de favoris (appliquée par la base, pas seulement par l'interface).
-- TG_ARGV[0] = nombre maximal de favoris actifs par utilisateur.
-- -----------------------------------------------------------------------------
create or replace function public.enforce_max_favorites()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
  v_limit integer := tg_argv[0]::integer;
begin
  if not new.is_favorite or not new.is_active then
    return new;
  end if;
  -- Sérialise les ajouts concurrents d'un même utilisateur.
  perform pg_advisory_xact_lock(hashtext(tg_table_name || new.user_id::text));
  execute format(
    'select count(*) from %I.%I where user_id = $1 and is_favorite and is_active and id <> $2',
    tg_table_schema, tg_table_name
  ) into v_count using new.user_id, new.id;
  if v_count >= v_limit then
    raise exception 'too_many_favorites' using errcode = '23514',
      hint = format('%s favoris au maximum.', v_limit);
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_max_favorites() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Personnes de soutien : personne principale (une au plus)
-- -----------------------------------------------------------------------------
alter table public.support_contacts
  add column is_primary boolean not null default false;

create unique index support_contacts_one_primary
  on public.support_contacts (user_id)
  where is_primary;

-- -----------------------------------------------------------------------------
-- Déclencheurs personnels : catalogue OU texte personnel
-- -----------------------------------------------------------------------------
create table public.user_personal_triggers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trigger_type_id uuid references public.trigger_types (id),
  custom_label text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_personal_triggers_source_xor check ((trigger_type_id is null) <> (custom_label is null)),
  constraint user_personal_triggers_custom_label_valid check (
    char_length(custom_label) between 1 and 80 and custom_label = btrim(custom_label)
  ),
  constraint user_personal_triggers_notes_length check (char_length(notes) between 1 and 1000)
);

-- Un déclencheur du catalogue une seule fois dans le plan.
create unique index user_personal_triggers_one_per_type
  on public.user_personal_triggers (user_id, trigger_type_id)
  where trigger_type_id is not null and is_active;
create index user_personal_triggers_user_id_idx on public.user_personal_triggers (user_id);

create trigger user_personal_triggers_set_updated_at
  before update on public.user_personal_triggers
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Stratégies personnelles : catalogue du Sprint 7 OU nom personnel.
-- Les interventions copient le texte ou la stratégie du catalogue : supprimer une
-- stratégie du plan ne modifie jamais l'historique (ADR-065).
-- -----------------------------------------------------------------------------
create table public.user_personal_strategies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  strategy_id uuid references public.craving_strategies (id),
  custom_name text,
  notes text,
  default_duration_minutes smallint,
  is_favorite boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_personal_strategies_source_xor check ((strategy_id is null) <> (custom_name is null)),
  constraint user_personal_strategies_custom_name_valid check (
    char_length(custom_name) between 1 and 120 and custom_name = btrim(custom_name)
  ),
  constraint user_personal_strategies_notes_length check (char_length(notes) between 1 and 1000),
  constraint user_personal_strategies_duration_valid check (default_duration_minutes in (5, 10, 15, 20))
);

create unique index user_personal_strategies_one_per_strategy
  on public.user_personal_strategies (user_id, strategy_id)
  where strategy_id is not null and is_active;
create index user_personal_strategies_user_id_idx on public.user_personal_strategies (user_id);

create trigger user_personal_strategies_set_updated_at
  before update on public.user_personal_strategies
  for each row execute function public.set_updated_at();

create trigger user_personal_strategies_max_favorites
  before insert or update of is_favorite, is_active on public.user_personal_strategies
  for each row execute function public.enforce_max_favorites('3');

-- -----------------------------------------------------------------------------
-- Lieux sûrs : texte libre, AUCUNE adresse ni coordonnée (ADR-067)
-- -----------------------------------------------------------------------------
create table public.safe_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  description text,
  is_favorite boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint safe_places_name_valid check (char_length(name) between 1 and 80 and name = btrim(name)),
  constraint safe_places_description_length check (char_length(description) between 1 and 300)
);

create index safe_places_user_id_idx on public.safe_places (user_id);

create trigger safe_places_set_updated_at
  before update on public.safe_places
  for each row execute function public.set_updated_at();

create trigger safe_places_max_favorites
  before insert or update of is_favorite, is_active on public.safe_places
  for each row execute function public.enforce_max_favorites('3');

-- -----------------------------------------------------------------------------
-- Rappel personnel (un par utilisateur en V1)
-- -----------------------------------------------------------------------------
create table public.personal_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint personal_reminders_one_per_user unique (user_id),
  constraint personal_reminders_content_valid check (char_length(btrim(content)) between 1 and 1000)
);

create trigger personal_reminders_set_updated_at
  before update on public.personal_reminders
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Lettre à soi-même (une par utilisateur en V1) — donnée particulièrement privée (ADR-068)
-- -----------------------------------------------------------------------------
create table public.self_letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint self_letters_one_per_user unique (user_id),
  constraint self_letters_title_valid check (char_length(title) between 1 and 120 and title = btrim(title)),
  constraint self_letters_content_valid check (char_length(btrim(content)) between 1 and 5000)
);

create trigger self_letters_set_updated_at
  before update on public.self_letters
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RPC (SECURITY INVOKER : RLS et privilèges de l'utilisateur s'appliquent)
-- -----------------------------------------------------------------------------

/** Ajoute une substance au suivi (catalogue, « Autre » avec précision). */
create or replace function public.add_user_substance(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_substance public.substances%rowtype;
  v_started date;
  v_custom text;
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_substance from public.substances s where s.slug = payload ->> 'slug' and s.is_active;
  if not found then
    raise exception 'invalid_substance' using errcode = '22023';
  end if;
  begin
    v_started := (payload ->> 'startedOn')::date;
  exception when others then
    raise exception 'invalid_started_on' using errcode = '22023';
  end;
  if v_started is null or v_started > public.current_user_local_date() then
    raise exception 'invalid_started_on' using errcode = '22023';
  end if;
  if (select count(*) from public.user_substances us where us.user_id = v_user_id and us.is_active) >= 6 then
    raise exception 'too_many_substances' using errcode = '23514';
  end if;
  v_custom := case when v_substance.category = 'other' then nullif(btrim(payload ->> 'customName'), '') end;

  -- L'index unique partiel refuse une substance déjà suivie (23505).
  insert into public.user_substances (user_id, substance_id, custom_name, goal, started_on)
  values (v_user_id, v_substance.id, v_custom, (payload ->> 'goal')::public.substance_goal, v_started)
  returning id into v_id;
  return v_id;
end;
$$;

/** Change la substance principale (échange atomique, index unique respecté). */
create or replace function public.set_primary_substance(p_user_substance_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.user_substances us
     where us.id = p_user_substance_id and us.user_id = v_user_id and us.is_active
  ) then
    raise exception 'user_substance_not_found' using errcode = 'P0002';
  end if;
  update public.user_substances set is_primary = false
   where user_id = v_user_id and is_primary and id <> p_user_substance_id;
  update public.user_substances set is_primary = true where id = p_user_substance_id;
end;
$$;

/**
 * Arrête le suivi (is_active = false) : la ligne reste pour l'historique
 * (consommations, moments d'envie). Refusé pour la substance principale et pour
 * la dernière substance suivie (ADR-065).
 */
create or replace function public.deactivate_user_substance(p_user_substance_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.user_substances%rowtype;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_row from public.user_substances us
   where us.id = p_user_substance_id and us.user_id = v_user_id and us.is_active
   for update;
  if not found then
    raise exception 'user_substance_not_found' using errcode = 'P0002';
  end if;
  if v_row.is_primary then
    raise exception 'primary_substance' using errcode = 'P0001';
  end if;
  if (select count(*) from public.user_substances us where us.user_id = v_user_id and us.is_active) <= 1 then
    raise exception 'last_substance' using errcode = 'P0001';
  end if;
  update public.user_substances set is_active = false where id = v_row.id;
end;
$$;

/** Remplace les motivations (au moins une ; précision seulement pour « other »). */
create or replace function public.set_user_motivations(payload jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_item text;
  v_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if jsonb_typeof(payload -> 'motivations') is distinct from 'array' then
    raise exception 'invalid_motivations' using errcode = '22023';
  end if;

  delete from public.user_motivations where user_id = v_user_id;
  for v_item in select jsonb_array_elements_text(payload -> 'motivations') loop
    insert into public.user_motivations (user_id, motivation, custom_label)
    values (
      v_user_id,
      v_item::public.motivation,
      case when v_item = 'other' then nullif(btrim(payload ->> 'otherLabel'), '') end
    );
    v_count := v_count + 1;
  end loop;
  if v_count = 0 then
    raise exception 'motivation_required' using errcode = '23514';
  end if;
end;
$$;

/** Définit (ou retire avec NULL) la personne de soutien principale. */
create or replace function public.set_primary_support_contact(p_contact_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_contact_id is not null and not exists (
    select 1 from public.support_contacts c where c.id = p_contact_id and c.user_id = v_user_id
  ) then
    raise exception 'support_contact_not_found' using errcode = 'P0002';
  end if;
  update public.support_contacts set is_primary = false where user_id = v_user_id and is_primary;
  if p_contact_id is not null then
    update public.support_contacts set is_primary = true where id = p_contact_id;
  end if;
end;
$$;

revoke execute on function public.add_user_substance(jsonb) from public, anon;
revoke execute on function public.set_primary_substance(uuid) from public, anon;
revoke execute on function public.deactivate_user_substance(uuid) from public, anon;
revoke execute on function public.set_user_motivations(jsonb) from public, anon;
revoke execute on function public.set_primary_support_contact(uuid) from public, anon;
grant execute on function public.add_user_substance(jsonb) to authenticated;
grant execute on function public.set_primary_substance(uuid) to authenticated;
grant execute on function public.deactivate_user_substance(uuid) to authenticated;
grant execute on function public.set_user_motivations(jsonb) to authenticated;
grant execute on function public.set_primary_support_contact(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Privilèges (least privilege)
-- -----------------------------------------------------------------------------
grant update (is_primary) on table public.support_contacts to authenticated;

revoke all on table public.user_personal_triggers from anon, authenticated;
grant select, insert, delete on table public.user_personal_triggers to authenticated;
grant update (custom_label, notes, is_active) on table public.user_personal_triggers to authenticated;

revoke all on table public.user_personal_strategies from anon, authenticated;
grant select, insert, delete on table public.user_personal_strategies to authenticated;
grant update (custom_name, notes, default_duration_minutes, is_favorite, is_active)
  on table public.user_personal_strategies to authenticated;

revoke all on table public.safe_places from anon, authenticated;
grant select, insert, delete on table public.safe_places to authenticated;
grant update (name, description, is_favorite, is_active) on table public.safe_places to authenticated;

revoke all on table public.personal_reminders from anon, authenticated;
grant select, insert, delete on table public.personal_reminders to authenticated;
grant update (content) on table public.personal_reminders to authenticated;

revoke all on table public.self_letters from anon, authenticated;
grant select, insert, delete on table public.self_letters to authenticated;
grant update (title, content) on table public.self_letters to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security : chaque utilisateur ne voit et ne modifie que ses lignes
-- -----------------------------------------------------------------------------
alter table public.user_personal_triggers enable row level security;
create policy "user_personal_triggers_select_own" on public.user_personal_triggers
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_personal_triggers_insert_own" on public.user_personal_triggers
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "user_personal_triggers_update_own" on public.user_personal_triggers
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "user_personal_triggers_delete_own" on public.user_personal_triggers
  for delete to authenticated using ((select auth.uid()) = user_id);

alter table public.user_personal_strategies enable row level security;
create policy "user_personal_strategies_select_own" on public.user_personal_strategies
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_personal_strategies_insert_own" on public.user_personal_strategies
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "user_personal_strategies_update_own" on public.user_personal_strategies
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "user_personal_strategies_delete_own" on public.user_personal_strategies
  for delete to authenticated using ((select auth.uid()) = user_id);

alter table public.safe_places enable row level security;
create policy "safe_places_select_own" on public.safe_places
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "safe_places_insert_own" on public.safe_places
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "safe_places_update_own" on public.safe_places
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "safe_places_delete_own" on public.safe_places
  for delete to authenticated using ((select auth.uid()) = user_id);

alter table public.personal_reminders enable row level security;
create policy "personal_reminders_select_own" on public.personal_reminders
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "personal_reminders_insert_own" on public.personal_reminders
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "personal_reminders_update_own" on public.personal_reminders
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "personal_reminders_delete_own" on public.personal_reminders
  for delete to authenticated using ((select auth.uid()) = user_id);

alter table public.self_letters enable row level security;
create policy "self_letters_select_own" on public.self_letters
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "self_letters_insert_own" on public.self_letters
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "self_letters_update_own" on public.self_letters
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "self_letters_delete_own" on public.self_letters
  for delete to authenticated using ((select auth.uid()) = user_id);
