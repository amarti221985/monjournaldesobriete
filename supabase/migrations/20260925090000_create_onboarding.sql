-- =============================================================================
-- Sprint 2 — Onboarding et configuration du parcours
--
-- - public.substances               : catalogue global contrôlé (lecture seule)
-- - public.user_substances          : substances suivies, objectif et date par substance
-- - public.personal_reasons         : « pourquoi » personnel
-- - public.user_motivations         : motivations (valeurs métier stables)
-- - public.support_contacts         : personnes de soutien (facultatif)
-- - public.onboarding_drafts        : brouillon du wizard (reprise après interruption)
-- - public.complete_onboarding()    : finalisation atomique et idempotente
-- - garde-fou en base               : onboarding_completed ne passe à true que si
--                                      les données minimales existent
-- - correction Sprint 1             : onboarding_completed n'est plus modifiable
--                                      directement par l'utilisateur
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------
create type public.substance_goal as enum ('abstinence', 'reduction', 'observation');

create type public.motivation as enum (
  'health',
  'energy',
  'sleep',
  'relationships',
  'family',
  'confidence',
  'finances',
  'career',
  'freedom',
  'clarity',
  'personal_project',
  'other'
);

-- -----------------------------------------------------------------------------
-- Catalogue global des substances (ADR-029)
-- Modifiable uniquement par migration. Lecture pour les utilisateurs connectés.
-- -----------------------------------------------------------------------------
create table public.substances (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_fr text not null,
  -- 'substance' : catégorie définie ; 'other' : l'utilisateur précise lui-même
  category text not null default 'substance',
  is_active boolean not null default true,
  sort_order smallint not null,
  created_at timestamptz not null default now(),

  constraint substances_slug_format check (slug ~ '^[a-z][a-z0-9_]{1,39}$'),
  constraint substances_name_length check (char_length(name_fr) between 1 and 60),
  constraint substances_category_valid check (category in ('substance', 'other'))
);

comment on table public.substances is
  'Catalogue global des catégories suivies. Modifié uniquement par migration.';

insert into public.substances (slug, name_fr, category, sort_order) values
  ('alcohol',   'Alcool',     'substance', 1),
  ('cannabis',  'Cannabis',   'substance', 2),
  ('nicotine',  'Nicotine',   'substance', 3),
  ('stimulants','Stimulants', 'substance', 4),
  ('opioids',   'Opioïdes',   'substance', 5),
  ('other',     'Autre',      'other',     6);

-- -----------------------------------------------------------------------------
-- Substances suivies par l'utilisateur (ADR-026)
-- -----------------------------------------------------------------------------
create table public.user_substances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  substance_id uuid not null references public.substances (id),
  -- Précision personnelle pour « Autre » (jamais ajoutée au catalogue global)
  custom_name text,
  goal public.substance_goal not null,
  -- Journée locale déclarée du début du parcours (ADR-027) : pas un timestamptz,
  -- et jamais une preuve de journées sobres.
  started_on date not null,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_substances_custom_name_valid check (
    custom_name is null
    or (char_length(custom_name) between 1 and 80 and custom_name = btrim(custom_name))
  ),
  constraint user_substances_started_on_range check (started_on >= date '1900-01-01'),
  constraint user_substances_primary_is_active check (not is_primary or is_active)
);

-- Une seule relation active par substance et par utilisateur.
create unique index user_substances_one_active_per_substance
  on public.user_substances (user_id, substance_id)
  where is_active;

-- Une seule substance principale active par utilisateur (ADR-030).
create unique index user_substances_one_primary
  on public.user_substances (user_id)
  where is_primary and is_active;

-- Accès par utilisateur (RLS et lecture du parcours), y compris lignes inactives.
create index user_substances_user_id_idx on public.user_substances (user_id);

create trigger user_substances_set_updated_at
  before update on public.user_substances
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Raison personnelle (« pourquoi »)
-- -----------------------------------------------------------------------------
create table public.personal_reasons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint personal_reasons_text_valid check (
    char_length(btrim(reason_text)) between 1 and 2000
  )
);

create index personal_reasons_user_id_idx on public.personal_reasons (user_id);

create trigger personal_reasons_set_updated_at
  before update on public.personal_reasons
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Motivations
-- -----------------------------------------------------------------------------
create table public.user_motivations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  motivation public.motivation not null,
  custom_label text,
  created_at timestamptz not null default now(),

  constraint user_motivations_unique unique (user_id, motivation),
  constraint user_motivations_custom_label_valid check (
    custom_label is null
    or (
      motivation = 'other'
      and char_length(custom_label) between 1 and 80
      and custom_label = btrim(custom_label)
    )
  )
);

-- -----------------------------------------------------------------------------
-- Personnes de soutien (données de tiers : strictement privées)
-- -----------------------------------------------------------------------------
create table public.support_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  relationship text,
  phone text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint support_contacts_name_valid check (
    char_length(name) between 1 and 80 and name = btrim(name)
  ),
  constraint support_contacts_relationship_valid check (
    relationship is null or char_length(relationship) between 1 and 60
  ),
  -- Validation volontairement souple : formats internationaux variés.
  constraint support_contacts_phone_valid check (
    phone is null or phone ~ '^[0-9+(). -]{3,32}$'
  ),
  constraint support_contacts_email_valid check (
    email is null or (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  )
);

create index support_contacts_user_id_idx on public.support_contacts (user_id);

create trigger support_contacts_set_updated_at
  before update on public.support_contacts
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Brouillon du wizard (ADR-031) : réponses en cours, côté serveur et sous RLS,
-- plutôt que dans le navigateur (raison personnelle et contact sont sensibles).
-- Supprimé à la finalisation.
-- -----------------------------------------------------------------------------
create table public.onboarding_drafts (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  current_step smallint not null default 1,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),

  constraint onboarding_drafts_step_range check (current_step between 1 and 8),
  constraint onboarding_drafts_data_object check (jsonb_typeof(data) = 'object'),
  constraint onboarding_drafts_data_size check (pg_column_size(data) <= 16384)
);

create trigger onboarding_drafts_set_updated_at
  before update on public.onboarding_drafts
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Garde-fou (ADR-028) : onboarding_completed ne peut passer à true que si les
-- données minimales existent. Protège contre tout chemin d'écriture.
-- -----------------------------------------------------------------------------
create or replace function public.ensure_onboarding_requirements()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.onboarding_completed and not old.onboarding_completed then
    if not exists (
         select 1 from public.user_substances us
         where us.user_id = new.id and us.is_active
       )
       or not exists (
         select 1 from public.user_substances us
         where us.user_id = new.id and us.is_active and us.is_primary
       )
       or not exists (
         select 1 from public.personal_reasons pr where pr.user_id = new.id
       )
       or not exists (
         select 1 from public.user_motivations um where um.user_id = new.id
       ) then
      raise exception 'onboarding_incomplete'
        using errcode = 'P0001',
              hint = 'Une substance active (dont une principale), une raison et une motivation sont requises.';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_ensure_onboarding_requirements
  before update of onboarding_completed on public.profiles
  for each row execute function public.ensure_onboarding_requirements();

-- -----------------------------------------------------------------------------
-- Finalisation atomique et idempotente (ADR-028)
--
-- Une seule transaction : soit tout est enregistré et onboarding_completed = true,
-- soit rien ne change. Verrou sur la ligne du profil : une double soumission
-- concurrente attend puis retourne 'already_completed'.
--
-- SECURITY DEFINER : nécessaire pour mettre à jour onboarding_completed, qui n'est
-- plus modifiable directement. L'identité vient exclusivement de auth.uid() ;
-- toutes les entrées sont revalidées ici (en plus de Zod côté serveur).
-- -----------------------------------------------------------------------------
create or replace function public.complete_onboarding(payload jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_completed boolean;
  v_timezone text;
  v_latest_today date;
  v_started_on date;
  v_reason text;
  v_primary_slug text;
  v_item jsonb;
  v_substance public.substances%rowtype;
  v_custom_name text;
  v_goal public.substance_goal;
  v_slugs text[] := '{}';
  v_motivation public.motivation;
  v_motivations public.motivation[] := '{}';
  v_other_label text;
  v_contact jsonb;
  v_contact_name text;
  v_contact_relationship text;
  v_contact_phone text;
  v_contact_email text;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select p.onboarding_completed, p.timezone
    into v_completed, v_timezone
    from public.profiles p
   where p.id = v_user_id
   for update;

  if not found then
    raise exception 'profile_not_found' using errcode = 'P0001';
  end if;

  -- Idempotence : une seconde soumission ne crée rien.
  if v_completed then
    return 'already_completed';
  end if;

  if jsonb_typeof(payload) is distinct from 'object' then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  -- Date de début : journée locale, jamais dans le futur selon le fuseau du profil
  -- (sans fuseau connu : fuseau le plus en avance, pour ne pas refuser à tort).
  begin
    v_started_on := (payload ->> 'startedOn')::date;
  exception when others then
    raise exception 'invalid_started_on' using errcode = '22023';
  end;
  v_latest_today := (now() at time zone coalesce(v_timezone, 'Pacific/Kiritimati'))::date;
  if v_started_on is null or v_started_on < date '1900-01-01' or v_started_on > v_latest_today then
    raise exception 'invalid_started_on' using errcode = '22023';
  end if;

  -- Raison personnelle
  v_reason := btrim(coalesce(payload ->> 'reason', ''));
  if char_length(v_reason) not between 1 and 2000 then
    raise exception 'invalid_reason' using errcode = '22023';
  end if;

  -- Substances : 1 à 6, slugs actifs du catalogue, sans doublon
  if jsonb_typeof(payload -> 'substances') is distinct from 'array'
     or jsonb_array_length(payload -> 'substances') not between 1 and 6 then
    raise exception 'invalid_substances' using errcode = '22023';
  end if;

  v_primary_slug := payload ->> 'primarySlug';

  for v_item in select * from jsonb_array_elements(payload -> 'substances') loop
    select s.* into v_substance
      from public.substances s
     where s.slug = v_item ->> 'slug' and s.is_active;
    if not found or v_substance.slug = any (v_slugs) then
      raise exception 'invalid_substances' using errcode = '22023';
    end if;
    v_slugs := v_slugs || v_substance.slug;

    begin
      v_goal := (v_item ->> 'goal')::public.substance_goal;
    exception when others then
      raise exception 'invalid_goal' using errcode = '22023';
    end;
    if v_goal is null then
      raise exception 'invalid_goal' using errcode = '22023';
    end if;

    v_custom_name := null;
    if v_substance.category = 'other' then
      v_custom_name := nullif(btrim(coalesce(v_item ->> 'customName', '')), '');
      if v_custom_name is not null and char_length(v_custom_name) > 80 then
        raise exception 'invalid_substances' using errcode = '22023';
      end if;
    end if;

    insert into public.user_substances
      (user_id, substance_id, custom_name, goal, started_on, is_primary)
    values
      (v_user_id, v_substance.id, v_custom_name, v_goal, v_started_on,
       v_substance.slug = v_primary_slug);
  end loop;

  if v_primary_slug is null or not (v_primary_slug = any (v_slugs)) then
    raise exception 'invalid_primary' using errcode = '22023';
  end if;

  insert into public.personal_reasons (user_id, reason_text) values (v_user_id, v_reason);

  -- Motivations : au moins une, valeurs de l'enum, sans doublon
  if jsonb_typeof(payload -> 'motivations') is distinct from 'array'
     or jsonb_array_length(payload -> 'motivations') not between 1 and 12 then
    raise exception 'invalid_motivations' using errcode = '22023';
  end if;
  v_other_label := nullif(btrim(coalesce(payload ->> 'motivationOther', '')), '');
  if v_other_label is not null and char_length(v_other_label) > 80 then
    raise exception 'invalid_motivations' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(payload -> 'motivations') loop
    begin
      v_motivation := (v_item #>> '{}')::public.motivation;
    exception when others then
      raise exception 'invalid_motivations' using errcode = '22023';
    end;
    if v_motivation = any (v_motivations) then
      raise exception 'invalid_motivations' using errcode = '22023';
    end if;
    v_motivations := v_motivations || v_motivation;

    insert into public.user_motivations (user_id, motivation, custom_label)
    values (
      v_user_id,
      v_motivation,
      case when v_motivation = 'other' then v_other_label end
    );
  end loop;

  -- Personne de soutien (facultative)
  v_contact := payload -> 'supportContact';
  if v_contact is not null and jsonb_typeof(v_contact) = 'object' then
    v_contact_name := nullif(btrim(coalesce(v_contact ->> 'name', '')), '');
    if v_contact_name is null then
      raise exception 'invalid_support_contact' using errcode = '22023';
    end if;
    v_contact_relationship := nullif(btrim(coalesce(v_contact ->> 'relationship', '')), '');
    v_contact_phone := nullif(btrim(coalesce(v_contact ->> 'phone', '')), '');
    v_contact_email := nullif(lower(btrim(coalesce(v_contact ->> 'email', ''))), '');

    -- Les contraintes CHECK de la table valident longueurs et formats.
    insert into public.support_contacts (user_id, name, relationship, phone, email)
    values (v_user_id, v_contact_name, v_contact_relationship, v_contact_phone, v_contact_email);
  elsif v_contact is not null and jsonb_typeof(v_contact) <> 'null' then
    raise exception 'invalid_support_contact' using errcode = '22023';
  end if;

  -- Le trigger ensure_onboarding_requirements revérifie les données minimales.
  update public.profiles set onboarding_completed = true where id = v_user_id;

  delete from public.onboarding_drafts where user_id = v_user_id;

  return 'completed';
end;
$$;

comment on function public.complete_onboarding(jsonb) is
  'Finalise l''onboarding de l''utilisateur courant de façon atomique et idempotente.';

revoke execute on function public.complete_onboarding(jsonb) from public, anon;
grant execute on function public.complete_onboarding(jsonb) to authenticated;

revoke execute on function public.ensure_onboarding_requirements() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Correction Sprint 1 (ADR-028) : onboarding_completed n'est modifiable que par
-- complete_onboarding(), jamais directement par l'utilisateur.
-- -----------------------------------------------------------------------------
revoke update (onboarding_completed) on table public.profiles from authenticated;

-- -----------------------------------------------------------------------------
-- Privilèges (least privilege)
-- -----------------------------------------------------------------------------
revoke all on table public.substances from anon, authenticated;
grant select on table public.substances to authenticated;

revoke all on table public.user_substances from anon, authenticated;
grant select, insert, delete on table public.user_substances to authenticated;
grant update (substance_id, custom_name, goal, started_on, is_primary, is_active)
  on table public.user_substances to authenticated;

revoke all on table public.personal_reasons from anon, authenticated;
grant select, insert, delete on table public.personal_reasons to authenticated;
grant update (reason_text) on table public.personal_reasons to authenticated;

revoke all on table public.user_motivations from anon, authenticated;
grant select, insert, delete on table public.user_motivations to authenticated;
grant update (motivation, custom_label) on table public.user_motivations to authenticated;

revoke all on table public.support_contacts from anon, authenticated;
grant select, insert, delete on table public.support_contacts to authenticated;
grant update (name, relationship, phone, email) on table public.support_contacts to authenticated;

revoke all on table public.onboarding_drafts from anon, authenticated;
grant select, insert, delete on table public.onboarding_drafts to authenticated;
grant update (current_step, data) on table public.onboarding_drafts to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.substances enable row level security;

create policy "substances_select_active"
  on public.substances for select to authenticated
  using (is_active);

-- Tables de données utilisateur : l'utilisateur ne voit et ne modifie que ses lignes.
alter table public.user_substances enable row level security;
create policy "user_substances_select_own" on public.user_substances
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_substances_insert_own" on public.user_substances
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "user_substances_update_own" on public.user_substances
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "user_substances_delete_own" on public.user_substances
  for delete to authenticated using ((select auth.uid()) = user_id);

alter table public.personal_reasons enable row level security;
create policy "personal_reasons_select_own" on public.personal_reasons
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "personal_reasons_insert_own" on public.personal_reasons
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "personal_reasons_update_own" on public.personal_reasons
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "personal_reasons_delete_own" on public.personal_reasons
  for delete to authenticated using ((select auth.uid()) = user_id);

alter table public.user_motivations enable row level security;
create policy "user_motivations_select_own" on public.user_motivations
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_motivations_insert_own" on public.user_motivations
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "user_motivations_update_own" on public.user_motivations
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "user_motivations_delete_own" on public.user_motivations
  for delete to authenticated using ((select auth.uid()) = user_id);

alter table public.support_contacts enable row level security;
create policy "support_contacts_select_own" on public.support_contacts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "support_contacts_insert_own" on public.support_contacts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "support_contacts_update_own" on public.support_contacts
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "support_contacts_delete_own" on public.support_contacts
  for delete to authenticated using ((select auth.uid()) = user_id);

alter table public.onboarding_drafts enable row level security;
create policy "onboarding_drafts_select_own" on public.onboarding_drafts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "onboarding_drafts_insert_own" on public.onboarding_drafts
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "onboarding_drafts_update_own" on public.onboarding_drafts
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "onboarding_drafts_delete_own" on public.onboarding_drafts
  for delete to authenticated using ((select auth.uid()) = user_id);
