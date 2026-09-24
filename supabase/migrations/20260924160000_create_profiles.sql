-- =============================================================================
-- Sprint 1 — Profils utilisateurs
--
-- - public.set_updated_at()   : fonction de trigger réutilisable pour updated_at
-- - public.profiles           : profil applicatif 1:1 avec auth.users
-- - public.handle_new_user()  : création automatique du profil à l'inscription
-- - RLS + privilèges minimaux : chaque utilisateur lit / modifie uniquement son profil
-- =============================================================================

-- -----------------------------------------------------------------------------
-- updated_at : maintenu par la base, jamais par l'application (ADR-020)
-- clock_timestamp() plutôt que now() : horodatage réel de la modification,
-- même lorsque plusieurs écritures ont lieu dans une même transaction.
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger BEFORE UPDATE réutilisable : met à jour la colonne updated_at.';

-- -----------------------------------------------------------------------------
-- Table profiles
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  timezone text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_display_name_valid check (
    display_name is null
    or (
      char_length(display_name) between 2 and 80
      and display_name = btrim(display_name)
    )
  ),
  -- Identifiant IANA (ex. America/Toronto). La validité exacte est vérifiée par
  -- l'application et par handle_new_user() ; ici on borne seulement la forme.
  constraint profiles_timezone_format check (
    timezone is null
    or (
      char_length(timezone) between 1 and 64
      and timezone ~ '^[A-Za-z0-9_+\-]+(/[A-Za-z0-9_+\-]+)*$'
    )
  )
);

comment on table public.profiles is
  'Profil applicatif, une ligne par utilisateur auth.users (créée par trigger).';
comment on column public.profiles.timezone is
  'Fuseau horaire IANA (ex. America/Toronto), jamais un décalage fixe.';
comment on column public.profiles.onboarding_completed is
  'Vrai lorsque le parcours d''onboarding (Sprint 2) est terminé.';

-- Aucun index supplémentaire : tous les accès se font par la clé primaire (id).

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Création automatique du profil (ADR-017)
--
-- SECURITY DEFINER : s'exécute avec les droits du propriétaire pour insérer
-- dans public.profiles depuis le contexte de Supabase Auth.
-- Les métadonnées d'inscription sont fournies par le client : elles sont
-- nettoyées et validées ici, et ignorées (NULL) si invalides, pour ne jamais
-- bloquer la création du compte.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_display_name text;
  v_timezone text;
begin
  v_display_name := nullif(
    btrim(
      regexp_replace(
        coalesce(new.raw_user_meta_data ->> 'display_name', ''),
        '[[:cntrl:][:space:]]+', ' ', 'g'
      )
    ),
    ''
  );
  if v_display_name is not null
     and char_length(v_display_name) not between 2 and 80 then
    v_display_name := null;
  end if;

  v_timezone := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'timezone', '')), '');
  if v_timezone is not null and (
       char_length(v_timezone) > 64
       or v_timezone !~ '^[A-Za-z0-9_+\-]+(/[A-Za-z0-9_+\-]+)*$'
       or not exists (
         select 1 from pg_catalog.pg_timezone_names tz where tz.name = v_timezone
       )
     ) then
    v_timezone := null;
  end if;

  insert into public.profiles (id, display_name, timezone)
  values (new.id, v_display_name, v_timezone);

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Trigger AFTER INSERT sur auth.users : crée le profil applicatif associé.';

-- Fonction de trigger uniquement : personne ne doit pouvoir l'appeler via l'API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Privilèges (least privilege, ADR-004)
--
-- - anon : aucun accès.
-- - authenticated : lecture, et modification des seules colonnes éditables.
--   Pas d'INSERT (le trigger crée le profil) ni de DELETE (suppression en
--   cascade depuis auth.users lors de la suppression du compte, Sprint 11).
-- -----------------------------------------------------------------------------
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name, timezone, onboarding_completed)
  on table public.profiles to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
