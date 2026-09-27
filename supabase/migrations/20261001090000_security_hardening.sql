-- =============================================================================
-- Sprint 11 — Sécurité, confidentialité et contrôle des données
--
-- Correctifs issus de l'audit (docs/SECURITY.md) :
-- - set_updated_at() n'est plus exécutable par anon / authenticated (fonction de trigger) ;
-- - user_substances.substance_id n'est plus modifiable (réécrirait l'historique lié) ;
-- - invariants appliqués par la base, quel que soit le chemin d'écriture (API directe
--   comprise) : aucune date métier future (check-in, moment d'envie, début de suivi),
--   6 substances actives au maximum, fuseau horaire IANA réel ;
-- Contrôle des données :
-- - delete_my_account() : suppression définitive du compte courant (auth.users →
--   cascades vérifiées sur toutes les tables personnelles, ADR-077).
-- =============================================================================

revoke execute on function public.set_updated_at() from public, anon, authenticated;

revoke update (substance_id) on table public.user_substances from authenticated;

-- -----------------------------------------------------------------------------
-- Journée locale la plus tardive acceptable pour l'utilisateur courant (fuseau du
-- profil, sinon le plus en avance : ne refuse jamais à tort « aujourd'hui »).
-- -----------------------------------------------------------------------------
create or replace function public.latest_allowed_local_date()
returns date
language sql
stable
security invoker
set search_path = ''
as $$
  select (now() at time zone coalesce(
    (select p.timezone from public.profiles p where p.id = (select auth.uid())),
    'Pacific/Kiritimati'
  ))::date;
$$;

-- Appelée par les triggers avec les droits de l'utilisateur (ne renvoie que sa propre journée).
revoke execute on function public.latest_allowed_local_date() from public, anon;
grant execute on function public.latest_allowed_local_date() to authenticated;

/**
 * Invariants de dates métier (TG_ARGV[0] = colonne). Appliqués aux écritures faites par
 * un utilisateur authentifié ; les opérations d'administration (auth.uid() NULL) ne sont
 * pas concernées. Les dates passées restent possibles (historique, modification).
 */
create or replace function public.enforce_no_future_business_date()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_value date;
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  v_value := (to_jsonb(new) ->> tg_argv[0])::date;
  if v_value is not null and v_value > public.latest_allowed_local_date() then
    raise exception 'future_business_date' using errcode = '23514',
      hint = 'Une journée métier ne peut pas être dans le futur.';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_no_future_business_date() from public, anon, authenticated;

create trigger daily_checkins_no_future_date
  before insert or update of checkin_date on public.daily_checkins
  for each row execute function public.enforce_no_future_business_date('checkin_date');

create trigger craving_events_no_future_date
  before insert or update of local_date on public.craving_events
  for each row execute function public.enforce_no_future_business_date('local_date');

create trigger user_substances_no_future_date
  before insert or update of started_on on public.user_substances
  for each row execute function public.enforce_no_future_business_date('started_on');

/** 6 substances actives au maximum, quel que soit le chemin d'écriture. */
create or replace function public.enforce_max_active_substances()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not new.is_active then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('user_substances' || new.user_id::text));
  if (select count(*) from public.user_substances us
       where us.user_id = new.user_id and us.is_active and us.id <> new.id) >= 6 then
    raise exception 'too_many_substances' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_max_active_substances() from public, anon, authenticated;

create trigger user_substances_max_active
  before insert or update of is_active on public.user_substances
  for each row execute function public.enforce_max_active_substances();

/** Fuseau horaire : identifiant IANA réellement connu (en plus du format). */
create or replace function public.enforce_valid_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.timezone is not null
     and not exists (select 1 from pg_catalog.pg_timezone_names tz where tz.name = new.timezone) then
    raise exception 'invalid_timezone' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_valid_timezone() from public, anon, authenticated;

create trigger profiles_valid_timezone
  before insert or update of timezone on public.profiles
  for each row execute function public.enforce_valid_timezone();

-- -----------------------------------------------------------------------------
-- Suppression définitive du compte (ADR-077)
--
-- SECURITY DEFINER NÉCESSAIRE : supprimer une ligne de auth.users exige des privilèges
-- que les rôles de l'application n'ont pas (aucune clé service_role n'est utilisée).
-- Ciblage strict : aucun paramètre, l'utilisateur supprimé est TOUJOURS auth.uid() ;
-- search_path vide ; aucun SQL dynamique. La suppression de auth.users déclenche les
-- ON DELETE CASCADE de toutes les tables personnelles (vérifiés par
-- supabase/tests/security_rls.sql) dans la MÊME transaction : pas d'état partiel.
-- Les confirmations (texte « SUPPRIMER », mot de passe, origine) sont vérifiées par la
-- Server Action avant l'appel.
-- -----------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  delete from auth.users where id = v_user_id;
  if not found then
    raise exception 'account_not_found' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
-- -----------------------------------------------------------------------------
-- Suppression de compte : les références vers user_substances (historique des
-- consommations et des moments d'envie) étaient vérifiées au milieu de la cascade
-- depuis auth.users, ce qui faisait échouer la suppression d'un compte ayant des
-- consommations. Clés rendues DIFFÉRÉES : vérifiées à la fin de la transaction, quand
-- toutes les cascades sont faites. Une suppression isolée d'une substance référencée
-- reste refusée (l'historique est protégé), et l'application ne supprime plus jamais
-- une substance : elle la désactive (ADR-065).
-- -----------------------------------------------------------------------------
alter table public.consumption_events
  drop constraint consumption_events_user_substance_id_user_id_fkey,
  add constraint consumption_events_user_substance_id_user_id_fkey
    foreign key (user_substance_id, user_id) references public.user_substances (id, user_id)
    deferrable initially deferred;

alter table public.craving_event_substances
  drop constraint craving_event_substances_user_substance_id_user_id_fkey,
  add constraint craving_event_substances_user_substance_id_user_id_fkey
    foreign key (user_substance_id, user_id) references public.user_substances (id, user_id)
    deferrable initially deferred;

revoke delete on table public.user_substances from authenticated;
drop policy if exists "user_substances_delete_own" on public.user_substances;
