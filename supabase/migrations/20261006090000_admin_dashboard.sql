-- =============================================================================
-- Admin Dashboard V1 — analytics produit, respectueuses de la vie privée.
--
-- Principes (docs/ADMIN.md) :
-- - rôle admin dans une table contrôlée côté serveur (admin_users), jamais modifiable via l'API ;
-- - analytics par fonctions SECURITY DEFINER qui vérifient le rôle et ne renvoient QUE des
--   agrégats ou des champs de compte/produit (jamais un texte du journal, du plan, de l'IA) ;
-- - activité significative = actions métier (check-in, envie, plan, bilan, rapport, avis) ;
-- - comptes admin et comptes de test exclus des statistiques ;
-- - événements produit minimaux (2 noms, aucune métadonnée), supprimés avec le compte.
-- Aucune clé service_role n'est nécessaire.
-- =============================================================================

-- Schéma interne : non exposé par l'API (PostgREST n'expose que « public »).
create schema if not exists admin_private;
revoke all on schema admin_private from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Rôles d'administration (aucun accès client : ni lecture, ni écriture)
-- -----------------------------------------------------------------------------
create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  constraint admin_users_role_valid check (role in ('owner', 'admin'))
);
alter table public.admin_users enable row level security;
revoke all on table public.admin_users from anon, authenticated;

-- Comptes de test exclus des statistiques (gérés par SQL seulement, comme admin_users).
create table public.analytics_excluded_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint analytics_excluded_users_reason_length check (char_length(reason) between 1 and 200)
);
alter table public.analytics_excluded_users enable row level security;
revoke all on table public.analytics_excluded_users from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Événements produit (seulement ce que les tables existantes ne permettent pas de mesurer)
-- -----------------------------------------------------------------------------
create table public.product_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_name text not null,
  occurred_at timestamptz not null default now(),
  -- Une ligne par événement, par personne et par journée UTC : assez pour l'activité.
  occurred_on date not null default ((now() at time zone 'UTC')::date),
  constraint product_events_name_valid check (event_name in ('plan_updated', 'pdf_report_launched')),
  constraint product_events_one_per_day unique (user_id, event_name, occurred_on)
);
create index product_events_occurred_idx on public.product_events (occurred_at);
alter table public.product_events enable row level security;
revoke all on table public.product_events from anon, authenticated;
-- Lecture de ses propres événements (export JSON) ; écriture uniquement par record_product_event().
grant select on table public.product_events to authenticated;
create policy "product_events_select_own" on public.product_events
  for select to authenticated using ((select auth.uid()) = user_id);

/** Enregistre un événement produit pour l'utilisateur courant (liste fermée, aucune métadonnée). */
create or replace function public.record_product_event(p_event text)
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
  if p_event not in ('plan_updated', 'pdf_report_launched') then
    raise exception 'invalid_event' using errcode = '22023';
  end if;
  insert into public.product_events (user_id, event_name) values (v_user_id, p_event)
  on conflict (user_id, event_name, occurred_on) do nothing;
end;
$$;
revoke execute on function public.record_product_event(text) from public, anon;
grant execute on function public.record_product_event(text) to authenticated;

-- -----------------------------------------------------------------------------
-- Avis bêta : statut de traitement (modifiable par l'admin seulement)
-- -----------------------------------------------------------------------------
alter table public.beta_feedback
  add column status text not null default 'new',
  add column status_updated_at timestamptz,
  add constraint beta_feedback_status_valid check (status in ('new', 'reviewed', 'resolved'));
create index beta_feedback_created_idx on public.beta_feedback (created_at desc);
-- Les droits client restent : insert (user_id, category, message, page_context) + select.

-- -----------------------------------------------------------------------------
-- Journal d'audit des actions admin qui modifient ou révèlent quelque chose
-- -----------------------------------------------------------------------------
create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  created_at timestamptz not null default now(),
  constraint admin_audit_log_action_valid check (action in ('feedback_status_changed', 'account_info_viewed')),
  constraint admin_audit_log_target_type_valid check (target_type in ('beta_feedback', 'user'))
);
alter table public.admin_audit_log enable row level security;
revoke all on table public.admin_audit_log from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Rôle de l'utilisateur courant
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_users a where a.user_id = auth.uid());
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function admin_private.assert_admin()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not exists (select 1 from public.admin_users a where a.user_id = auth.uid()) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Définitions internes (une seule source de vérité, utilisée par toutes les RPC)
-- -----------------------------------------------------------------------------

/** Comptes pris en compte : tous sauf admins et comptes de test exclus. */
create or replace function admin_private.product_users()
returns table (user_id uuid, created_at timestamptz, onboarding_completed boolean)
language sql
stable
set search_path = ''
as $$
  select u.id, u.created_at, coalesce(p.onboarding_completed, false)
    from auth.users u
    left join public.profiles p on p.id = u.id
   where not exists (select 1 from public.admin_users a where a.user_id = u.id)
     and not exists (select 1 from public.analytics_excluded_users x where x.user_id = u.id);
$$;

/**
 * Activité significative (horodatages UTC) : check-in terminé ou modifié après coup, moment
 * d'envie terminé, plan modifié, rapport PDF lancé, bilan IA enregistré, avis envoyé.
 * Jamais une connexion, une page vue ni un préchargement.
 */
create or replace function admin_private.meaningful_activity()
returns table (user_id uuid, occurred_at timestamptz)
language sql
stable
set search_path = ''
as $$
  select c.user_id, c.completed_at from public.daily_checkins c where c.completed_at is not null
  union all
  select c.user_id, c.updated_at from public.daily_checkins c
   where c.completed_at is not null and c.updated_at > c.completed_at + interval '1 minute'
  union all
  select e.user_id, e.completed_at from public.craving_events e where e.status = 'completed' and e.completed_at is not null
  union all
  select pe.user_id, pe.occurred_at from public.product_events pe
  union all
  select r.user_id, r.generated_at from public.ai_reflections r
  union all
  select f.user_id, f.created_at from public.beta_feedback f;
$$;

revoke execute on all functions in schema admin_private from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- RPC admin (SECURITY DEFINER, vérification du rôle en premier, agrégats seulement)
-- -----------------------------------------------------------------------------

/** Indicateurs clés : période [p_from, p_to[ + cumul + fenêtres de 7 et 30 jours. */
create or replace function public.admin_overview(p_from timestamptz, p_to timestamptz)
returns table (
  total_users integer,
  new_users integer,
  active_users integer,
  onboarded_total integer,
  first_checkin_total integer,
  checkins integer,
  new_users_7d integer,
  active_users_7d integer,
  active_users_30d integer,
  checkins_7d integer,
  users_3_checkins integer,
  users_7_checkins integer,
  feedback_period integer,
  feedback_total integer,
  ai_reflections_period integer,
  ai_reflections_total integer,
  pdf_reports_period integer,
  pdf_reports_total integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform admin_private.assert_admin();
  return query
  with pu as (select * from admin_private.product_users()),
  act as (
    select a.user_id, a.occurred_at from admin_private.meaningful_activity() a
     where exists (select 1 from pu where pu.user_id = a.user_id)
  ),
  ci as (
    select c.user_id, c.completed_at from public.daily_checkins c
     where c.completed_at is not null and exists (select 1 from pu where pu.user_id = c.user_id)
  ),
  per_user as (select ci.user_id, count(*) as n from ci group by ci.user_id),
  fb as (select f.created_at from public.beta_feedback f where exists (select 1 from pu where pu.user_id = f.user_id)),
  ai as (select r.generated_at from public.ai_reflections r where exists (select 1 from pu where pu.user_id = r.user_id)),
  pdf as (
    select pe.occurred_at from public.product_events pe
     where pe.event_name = 'pdf_report_launched' and exists (select 1 from pu where pu.user_id = pe.user_id)
  )
  select
    (select count(*) from pu)::integer,
    (select count(*) from pu where pu.created_at >= p_from and pu.created_at < p_to)::integer,
    (select count(distinct act.user_id) from act where act.occurred_at >= p_from and act.occurred_at < p_to)::integer,
    (select count(*) from pu where pu.onboarding_completed)::integer,
    (select count(*) from per_user)::integer,
    (select count(*) from ci where ci.completed_at >= p_from and ci.completed_at < p_to)::integer,
    (select count(*) from pu where pu.created_at >= now() - interval '7 days')::integer,
    (select count(distinct act.user_id) from act where act.occurred_at >= now() - interval '7 days')::integer,
    (select count(distinct act.user_id) from act where act.occurred_at >= now() - interval '30 days')::integer,
    (select count(*) from ci where ci.completed_at >= now() - interval '7 days')::integer,
    (select count(*) from per_user where per_user.n >= 3)::integer,
    (select count(*) from per_user where per_user.n >= 7)::integer,
    (select count(*) from fb where fb.created_at >= p_from and fb.created_at < p_to)::integer,
    (select count(*) from fb)::integer,
    (select count(*) from ai where ai.generated_at >= p_from and ai.generated_at < p_to)::integer,
    (select count(*) from ai)::integer,
    (select count(*) from pdf where pdf.occurred_at >= p_from and pdf.occurred_at < p_to)::integer,
    (select count(*) from pdf)::integer;
end;
$$;

/** Séries temporelles (jour ou semaine UTC) : inscriptions, personnes actives, check-ins. */
create or replace function public.admin_timeseries(p_from timestamptz, p_to timestamptz, p_bucket text)
returns table (bucket date, signups integer, active_users integer, checkins integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_step interval;
begin
  perform admin_private.assert_admin();
  if p_bucket not in ('day', 'week') then
    raise exception 'invalid_bucket' using errcode = '22023';
  end if;
  v_step := case p_bucket when 'day' then interval '1 day' else interval '1 week' end;
  return query
  with pu as (select * from admin_private.product_users()),
  buckets as (
    select generate_series(
      date_trunc(p_bucket, p_from at time zone 'UTC'),
      date_trunc(p_bucket, (p_to - interval '1 microsecond') at time zone 'UTC'),
      v_step
    )::date as b
  ),
  s as (
    select date_trunc(p_bucket, pu.created_at at time zone 'UTC')::date as b, count(*) as n
      from pu where pu.created_at >= p_from and pu.created_at < p_to group by 1
  ),
  a as (
    select date_trunc(p_bucket, x.occurred_at at time zone 'UTC')::date as b, count(distinct x.user_id) as n
      from admin_private.meaningful_activity() x
     where x.occurred_at >= p_from and x.occurred_at < p_to and exists (select 1 from pu where pu.user_id = x.user_id)
     group by 1
  ),
  c as (
    select date_trunc(p_bucket, d.completed_at at time zone 'UTC')::date as b, count(*) as n
      from public.daily_checkins d
     where d.completed_at >= p_from and d.completed_at < p_to and exists (select 1 from pu where pu.user_id = d.user_id)
     group by 1
  )
  select buckets.b, coalesce(s.n, 0)::integer, coalesce(a.n, 0)::integer, coalesce(c.n, 0)::integer
    from buckets
    left join s on s.b = buckets.b
    left join a on a.b = buckets.b
    left join c on c.b = buckets.b
   order by buckets.b;
end;
$$;

/**
 * Entonnoir d'activation des personnes inscrites pendant la période :
 * inscription → onboarding → premier check-in → retour (activité un jour UTC postérieur au
 * premier check-in) → actif à J7 (activité au jour 7 ou après, parmi celles qui ont eu le temps).
 */
create or replace function public.admin_funnel(p_from timestamptz, p_to timestamptz)
returns table (signups integer, onboarded integer, first_checkin integer, returned integer, j7_eligible integer, active_j7 integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform admin_private.assert_admin();
  return query
  with cohort as (
    select pu.user_id, pu.onboarding_completed, (pu.created_at at time zone 'UTC')::date as signup_day
      from admin_private.product_users() pu
     where pu.created_at >= p_from and pu.created_at < p_to
  ),
  firsts as (
    select c.user_id, min((c.completed_at at time zone 'UTC')::date) as first_day
      from public.daily_checkins c
     where c.completed_at is not null and exists (select 1 from cohort where cohort.user_id = c.user_id)
     group by c.user_id
  ),
  last_act as (
    select x.user_id, max((x.occurred_at at time zone 'UTC')::date) as last_day
      from admin_private.meaningful_activity() x
     where exists (select 1 from cohort where cohort.user_id = x.user_id)
     group by x.user_id
  ),
  steps as (
    select cohort.user_id,
           cohort.onboarding_completed as s2,
           (cohort.onboarding_completed and firsts.user_id is not null) as s3,
           (cohort.onboarding_completed and firsts.user_id is not null and last_act.last_day > firsts.first_day) as s4,
           ((now() at time zone 'UTC')::date - cohort.signup_day >= 7) as eligible,
           (last_act.last_day - cohort.signup_day >= 7) as j7
      from cohort
      left join firsts on firsts.user_id = cohort.user_id
      left join last_act on last_act.user_id = cohort.user_id
  )
  select count(*)::integer,
         count(*) filter (where s2)::integer,
         count(*) filter (where s3)::integer,
         count(*) filter (where s4)::integer,
         count(*) filter (where s4 and eligible)::integer,
         count(*) filter (where s4 and eligible and coalesce(j7, false))::integer
    from steps;
end;
$$;

/**
 * Rétention par cohorte hebdomadaire (lundi UTC). Jn : activité significative au jour n ou après
 * (jours calendaires UTC depuis l'inscription). Dénominateur : personnes de la cohorte ayant eu
 * le temps d'atteindre le jour n (eN) ; rN parmi elles.
 */
create or replace function public.admin_retention()
returns table (
  cohort_week date, signups integer,
  e1 integer, r1 integer, e3 integer, r3 integer, e7 integer, r7 integer,
  e14 integer, r14 integer, e30 integer, r30 integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform admin_private.assert_admin();
  return query
  with users as (
    select pu.user_id, (pu.created_at at time zone 'UTC')::date as signup_day from admin_private.product_users() pu
  ),
  last_act as (
    select x.user_id, max((x.occurred_at at time zone 'UTC')::date) as last_day
      from admin_private.meaningful_activity() x group by x.user_id
  ),
  u as (
    select date_trunc('week', users.signup_day)::date as wk,
           (now() at time zone 'UTC')::date - users.signup_day as age,
           coalesce(last_act.last_day - users.signup_day, -1) as reach
      from users left join last_act on last_act.user_id = users.user_id
  )
  select u.wk, count(*)::integer,
         count(*) filter (where u.age >= 1)::integer, count(*) filter (where u.age >= 1 and u.reach >= 1)::integer,
         count(*) filter (where u.age >= 3)::integer, count(*) filter (where u.age >= 3 and u.reach >= 3)::integer,
         count(*) filter (where u.age >= 7)::integer, count(*) filter (where u.age >= 7 and u.reach >= 7)::integer,
         count(*) filter (where u.age >= 14)::integer, count(*) filter (where u.age >= 14 and u.reach >= 14)::integer,
         count(*) filter (where u.age >= 30)::integer, count(*) filter (where u.age >= 30 and u.reach >= 30)::integer
    from u group by u.wk order by u.wk desc;
end;
$$;

/** Utilisation des fonctionnalités : personnes distinctes pendant la période (aucun contenu). */
create or replace function public.admin_feature_adoption(p_from timestamptz, p_to timestamptz)
returns table (feature text, users integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform admin_private.assert_admin();
  return query
  with pu as (select pu0.user_id from admin_private.product_users() pu0)
  select 'checkin'::text, count(distinct c.user_id)::integer from public.daily_checkins c
   where c.completed_at >= p_from and c.completed_at < p_to and c.user_id in (select pu.user_id from pu)
  union all
  select 'craving', count(distinct e.user_id)::integer from public.craving_events e
   where e.status = 'completed' and e.completed_at >= p_from and e.completed_at < p_to and e.user_id in (select pu.user_id from pu)
  union all
  select 'plan', count(distinct pe.user_id)::integer from public.product_events pe
   where pe.event_name = 'plan_updated' and pe.occurred_at >= p_from and pe.occurred_at < p_to and pe.user_id in (select pu.user_id from pu)
  union all
  select 'achievements', count(distinct ua.user_id)::integer from public.user_achievements ua
   where ua.earned_at >= p_from and ua.earned_at < p_to and ua.user_id in (select pu.user_id from pu)
  union all
  select 'ai', count(distinct r.user_id)::integer from public.ai_reflections r
   where r.generated_at >= p_from and r.generated_at < p_to and r.user_id in (select pu.user_id from pu)
  union all
  select 'pdf', count(distinct pe.user_id)::integer from public.product_events pe
   where pe.event_name = 'pdf_report_launched' and pe.occurred_at >= p_from and pe.occurred_at < p_to and pe.user_id in (select pu.user_id from pu)
  union all
  select 'feedback', count(distinct f.user_id)::integer from public.beta_feedback f
   where f.created_at >= p_from and f.created_at < p_to and f.user_id in (select pu.user_id from pu);
end;
$$;

/** Code pseudonyme stable d'un compte (jamais l'UUID, le courriel ni le nom). */
create or replace function admin_private.user_code(p_user_id uuid)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(substr(md5(p_user_id::text), 1, 8));
$$;
revoke execute on function admin_private.user_code(uuid) from public, anon, authenticated;

/**
 * Liste paginée des comptes (pseudonymes) : inscription, onboarding, premier check-in, dernière
 * activité significative, nombre de check-ins. Filtres et seuils fournis par l'application
 * (definitions.ts), validés ici.
 */
create or replace function public.admin_users_page(
  p_filter text, p_sort text, p_limit integer, p_offset integer,
  p_new_days integer, p_active_days integer, p_inactive_days integer
)
returns table (
  code text, signed_up_at timestamptz, onboarded boolean, first_checkin_at timestamptz,
  last_activity_at timestamptz, checkins integer, total_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform admin_private.assert_admin();
  if p_filter not in ('all', 'new', 'activated', 'active', 'inactive', 'onboarding_incomplete')
     or p_sort not in ('recent', 'oldest', 'activity')
     or p_limit not between 1 and 100 or p_offset < 0
     or p_new_days not between 1 and 365 or p_active_days not between 1 and 365 or p_inactive_days not between 1 and 365 then
    raise exception 'invalid_parameters' using errcode = '22023';
  end if;
  return query
  with pu as (select * from admin_private.product_users()),
  ci as (
    select c.user_id, min(c.completed_at) as first_at, count(*) as n
      from public.daily_checkins c where c.completed_at is not null group by c.user_id
  ),
  la as (select x.user_id, max(x.occurred_at) as last_at from admin_private.meaningful_activity() x group by x.user_id),
  rows_ as (
    select pu.user_id, pu.created_at, pu.onboarding_completed, ci.first_at, la.last_at, coalesce(ci.n, 0) as n
      from pu left join ci on ci.user_id = pu.user_id left join la on la.user_id = pu.user_id
  ),
  filtered as (
    select * from rows_ r
     where case p_filter
       when 'new' then r.created_at >= now() - make_interval(days => p_new_days)
       when 'activated' then r.onboarding_completed and r.first_at is not null
       when 'active' then r.last_at >= now() - make_interval(days => p_active_days)
       when 'inactive' then r.last_at is null or r.last_at < now() - make_interval(days => p_inactive_days)
       when 'onboarding_incomplete' then not r.onboarding_completed
       else true end
  )
  select admin_private.user_code(f.user_id), f.created_at, f.onboarding_completed, f.first_at, f.last_at,
         f.n::integer, (count(*) over ())::integer
    from filtered f
   order by
     case when p_sort = 'recent' then f.created_at end desc,
     case when p_sort = 'oldest' then f.created_at end asc,
     case when p_sort = 'activity' then f.last_at end desc nulls last,
     f.created_at desc
   limit p_limit offset p_offset;
end;
$$;

/** Fiche produit d'un compte (par code pseudonyme) : aucune donnée du journal. */
create or replace function public.admin_user_detail(p_code text)
returns table (
  code text, signed_up_at timestamptz, onboarded boolean, first_checkin_at timestamptz,
  last_activity_at timestamptz, checkins integer, used_checkin boolean, used_craving boolean,
  used_plan boolean, used_ai boolean, used_pdf boolean, used_achievements boolean, feedback_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  perform admin_private.assert_admin();
  if p_code !~ '^[0-9A-F]{8}$' then
    raise exception 'invalid_parameters' using errcode = '22023';
  end if;
  select pu.user_id into v_user_id from admin_private.product_users() pu
   where admin_private.user_code(pu.user_id) = p_code limit 1;
  if v_user_id is null then
    return;
  end if;
  return query
  select p_code, pu.created_at, pu.onboarding_completed,
         (select min(c.completed_at) from public.daily_checkins c where c.user_id = v_user_id and c.completed_at is not null),
         (select max(x.occurred_at) from admin_private.meaningful_activity() x where x.user_id = v_user_id),
         (select count(*) from public.daily_checkins c where c.user_id = v_user_id and c.completed_at is not null)::integer,
         exists (select 1 from public.daily_checkins c where c.user_id = v_user_id and c.completed_at is not null),
         exists (select 1 from public.craving_events e where e.user_id = v_user_id and e.status = 'completed'),
         exists (select 1 from public.product_events pe where pe.user_id = v_user_id and pe.event_name = 'plan_updated'),
         exists (select 1 from public.ai_reflections r where r.user_id = v_user_id),
         exists (select 1 from public.product_events pe where pe.user_id = v_user_id and pe.event_name = 'pdf_report_launched'),
         exists (select 1 from public.user_achievements ua where ua.user_id = v_user_id),
         (select count(*) from public.beta_feedback f where f.user_id = v_user_id)::integer
    from admin_private.product_users() pu where pu.user_id = v_user_id;
end;
$$;

/**
 * Révèle le courriel d'un compte, pour le support uniquement (action volontaire, journalisée).
 */
create or replace function public.admin_reveal_account_email(p_code text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_email text;
begin
  perform admin_private.assert_admin();
  if p_code !~ '^[0-9A-F]{8}$' then
    raise exception 'invalid_parameters' using errcode = '22023';
  end if;
  select u.id, u.email::text into v_user_id, v_email from auth.users u
   where admin_private.user_code(u.id) = p_code
     and not exists (select 1 from public.admin_users a where a.user_id = u.id)
   limit 1;
  if v_user_id is null then
    return null;
  end if;
  insert into public.admin_audit_log (admin_user_id, action, target_type, target_id)
  values (auth.uid(), 'account_info_viewed', 'user', p_code);
  return v_email;
end;
$$;

/** Avis bêta (envoyés explicitement à l'équipe) : liste paginée, auteur pseudonymisé. */
create or replace function public.admin_feedback_page(p_category text, p_status text, p_limit integer, p_offset integer)
returns table (
  id uuid, created_at timestamptz, code text, excluded boolean, category text, message text,
  page_context text, status text, total_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform admin_private.assert_admin();
  if (p_category is not null and p_category not in ('bug', 'confusing', 'suggestion', 'like'))
     or (p_status is not null and p_status not in ('new', 'reviewed', 'resolved'))
     or p_limit not between 1 and 100 or p_offset < 0 then
    raise exception 'invalid_parameters' using errcode = '22023';
  end if;
  return query
  select f.id, f.created_at, admin_private.user_code(f.user_id),
         not exists (select 1 from admin_private.product_users() pu where pu.user_id = f.user_id),
         f.category, f.message, f.page_context, f.status, (count(*) over ())::integer
    from public.beta_feedback f
   where (p_category is null or f.category = p_category) and (p_status is null or f.status = p_status)
   order by f.created_at desc
   limit p_limit offset p_offset;
end;
$$;

/** Change le statut de traitement d'un avis (seule modification possible par l'admin). */
create or replace function public.admin_set_feedback_status(p_id uuid, p_status text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform admin_private.assert_admin();
  if p_status not in ('new', 'reviewed', 'resolved') then
    raise exception 'invalid_parameters' using errcode = '22023';
  end if;
  update public.beta_feedback set status = p_status, status_updated_at = now() where id = p_id;
  if not found then
    return false;
  end if;
  insert into public.admin_audit_log (admin_user_id, action, target_type, target_id)
  values (auth.uid(), 'feedback_status_changed', 'beta_feedback', p_id::text);
  return true;
end;
$$;

-- Droits : authentifiés seulement (la vérification du rôle est interne à chaque fonction).
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.admin_overview(timestamptz, timestamptz)',
    'public.admin_timeseries(timestamptz, timestamptz, text)',
    'public.admin_funnel(timestamptz, timestamptz)',
    'public.admin_retention()',
    'public.admin_feature_adoption(timestamptz, timestamptz)',
    'public.admin_users_page(text, text, integer, integer, integer, integer, integer)',
    'public.admin_user_detail(text)',
    'public.admin_reveal_account_email(text)',
    'public.admin_feedback_page(text, text, integer, integer)',
    'public.admin_set_feedback_status(uuid, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;
