-- =============================================================================
-- Sprint 9 — Accomplissements et jalons
--
-- - public.achievement_category      : sobriety | consistency | reflection | understanding | action | plan
-- - public.achievement_definitions   : catalogue stable (slug, métrique, seuil, libellés, icône)
-- - public.user_achievements         : ÉVÉNEMENTS HISTORIQUES obtenus, jamais retirés (ADR-069)
-- - public.achievement_metric_events : métriques calculées à la volée (aucun compteur persisté),
--                                      mêmes définitions que les Sprints 4 et 7
-- - public.award_achievements()      : attribution côté serveur (SECURITY DEFINER ciblé, ADR-073)
-- - public.get_achievement_progress(): valeurs actuelles des métriques de l'utilisateur courant
-- =============================================================================

create type public.achievement_category as enum ('sobriety', 'consistency', 'reflection', 'understanding', 'action', 'plan');

-- -----------------------------------------------------------------------------
-- Catalogue (modifié uniquement par migration)
-- metric : clé d'une métrique calculée par achievement_metric_events().
-- threshold : valeur à atteindre ; is_quantitative : afficher une progression « 42 / 60 ».
-- -----------------------------------------------------------------------------
create table public.achievement_definitions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  category public.achievement_category not null,
  metric text not null,
  threshold integer not null,
  is_quantitative boolean not null default true,
  name_fr text not null,
  description_fr text not null,
  icon_key text,
  sort_order integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint achievement_definitions_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint achievement_definitions_metric_valid check (metric in (
    'sober_days', 'best_streak', 'checkins', 'reflection_days', 'victory_days', 'trigger_days',
    'emotion_days', 'craving_interventions', 'strategies_tried', 'plan_reason', 'plan_motivations',
    'plan_triggers', 'plan_strategies', 'plan_support', 'plan_safe_places', 'plan_reminder',
    'plan_letter', 'plan_elements'
  )),
  constraint achievement_definitions_threshold_positive check (threshold >= 1),
  constraint achievement_definitions_metric_threshold_unique unique (metric, threshold)
);

create trigger achievement_definitions_set_updated_at
  before update on public.achievement_definitions
  for each row execute function public.set_updated_at();

-- Seed idempotent : slugs stables ; libellés conformes au calcul (cumulatif ≠ consécutif).
insert into public.achievement_definitions (slug, category, metric, threshold, is_quantitative, name_fr, description_fr, icon_key, sort_order) values
  -- Sobriété : journées sobres CUMULÉES (non nécessairement consécutives)
  ('sober-days-1',   'sobriety', 'sober_days', 1,   true, 'Première journée sobre',        'Une première journée sobre enregistrée.',                  'leaf',    101),
  ('sober-days-3',   'sobriety', 'sober_days', 3,   true, 'Trois journées sobres',         '3 journées sobres enregistrées au total.',                 'leaf',    102),
  ('sober-days-7',   'sobriety', 'sober_days', 7,   true, 'Une semaine de progression',    '7 journées sobres enregistrées au total.',                 'leaf',    103),
  ('sober-days-14',  'sobriety', 'sober_days', 14,  true, 'Deux semaines de progression',  '14 journées sobres enregistrées au total.',                'leaf',    104),
  ('sober-days-30',  'sobriety', 'sober_days', 30,  true, '30 journées sobres',            '30 journées sobres enregistrées au total.',                'sunrise', 105),
  ('sober-days-60',  'sobriety', 'sober_days', 60,  true, '60 journées sobres',            '60 journées sobres enregistrées au total.',                'sunrise', 106),
  ('sober-days-90',  'sobriety', 'sober_days', 90,  true, '90 journées sobres',            '90 journées sobres enregistrées au total.',                'sunrise', 107),
  ('sober-days-180', 'sobriety', 'sober_days', 180, true, '180 journées sobres',           '180 journées sobres enregistrées au total.',               'sunrise', 108),
  ('sober-days-365', 'sobriety', 'sober_days', 365, true, '365 journées sobres',           '365 journées sobres enregistrées au total.',               'sunrise', 109),
  -- Sobriété : séries (secondaires, historiques)
  ('streak-7',  'sobriety', 'best_streak', 7,  true, '7 journées dans une même série',  '7 journées sobres enregistrées dans une même série.',  'trending-up', 121),
  ('streak-14', 'sobriety', 'best_streak', 14, true, '14 journées dans une même série', '14 journées sobres enregistrées dans une même série.', 'trending-up', 122),
  ('streak-30', 'sobriety', 'best_streak', 30, true, '30 journées dans une même série', '30 journées sobres enregistrées dans une même série.', 'trending-up', 123),
  ('streak-60', 'sobriety', 'best_streak', 60, true, '60 journées dans une même série', '60 journées sobres enregistrées dans une même série.', 'trending-up', 124),
  ('streak-90', 'sobriety', 'best_streak', 90, true, '90 journées dans une même série', '90 journées sobres enregistrées dans une même série.', 'trending-up', 125),
  -- Constance : check-ins terminés (non nécessairement consécutifs)
  ('checkins-1',   'consistency', 'checkins', 1,   true, 'Premier check-in',                    'Un premier check-in complété.',       'calendar-check', 201),
  ('checkins-3',   'consistency', 'checkins', 3,   true, 'Je prends le temps de faire le point', '3 check-ins complétés au total.',     'calendar-check', 202),
  ('checkins-7',   'consistency', 'checkins', 7,   true, 'Une habitude qui se construit',       '7 check-ins complétés au total.',     'calendar-check', 203),
  ('checkins-14',  'consistency', 'checkins', 14,  true, '14 check-ins',                        '14 check-ins complétés au total.',    'calendar-check', 204),
  ('checkins-30',  'consistency', 'checkins', 30,  true, '30 check-ins',                        '30 check-ins complétés au total.',    'calendar-check', 205),
  ('checkins-60',  'consistency', 'checkins', 60,  true, '60 check-ins',                        '60 check-ins complétés au total.',    'calendar-check', 206),
  ('checkins-100', 'consistency', 'checkins', 100, true, '100 check-ins',                       '100 check-ins complétés au total.',   'calendar-check', 207),
  ('checkins-250', 'consistency', 'checkins', 250, true, '250 check-ins',                       '250 check-ins complétés au total.',   'calendar-check', 208),
  ('checkins-365', 'consistency', 'checkins', 365, true, '365 check-ins',                       '365 check-ins complétés au total.',   'calendar-check', 209),
  -- Réflexion
  ('reflections-1',  'reflection', 'reflection_days', 1,  true, 'Première réflexion',          'Un premier check-in avec une réflexion écrite.', 'book-open', 301),
  ('reflections-5',  'reflection', 'reflection_days', 5,  true, 'Je prends du recul',          '5 check-ins avec une réflexion écrite.',         'book-open', 302),
  ('reflections-10', 'reflection', 'reflection_days', 10, true, 'J''apprends de mon parcours', '10 check-ins avec une réflexion écrite.',        'book-open', 303),
  ('reflections-25', 'reflection', 'reflection_days', 25, true, 'Je continue d''apprendre',    '25 check-ins avec une réflexion écrite.',        'book-open', 304),
  ('reflections-50', 'reflection', 'reflection_days', 50, true, '50 réflexions',               '50 check-ins avec une réflexion écrite.',        'book-open', 305),
  ('victories-1',  'reflection', 'victory_days', 1,  true, 'Première victoire enregistrée', 'Une première victoire du jour notée.', 'star', 311),
  ('victories-10', 'reflection', 'victory_days', 10, true, '10 victoires enregistrées',     '10 victoires du jour notées.',        'star', 312),
  ('victories-25', 'reflection', 'victory_days', 25, true, '25 victoires enregistrées',     '25 victoires du jour notées.',        'star', 313),
  -- Compréhension : JOURNÉES où l'on a pris le temps d'identifier (jamais le nombre de déclencheurs)
  ('trigger-days-1',  'understanding', 'trigger_days', 1,  true, 'Je commence à observer',         'Un premier check-in où tu as identifié un déclencheur.', 'search', 401),
  ('trigger-days-5',  'understanding', 'trigger_days', 5,  true, 'Je reconnais mes déclencheurs',  '5 check-ins où tu as identifié un déclencheur.',         'search', 402),
  ('trigger-days-10', 'understanding', 'trigger_days', 10, true, 'Je comprends mieux mes situations', '10 check-ins où tu as identifié un déclencheur.',     'lightbulb', 403),
  ('emotion-days-5',  'understanding', 'emotion_days', 5,  true, 'Je mets des mots sur ce que je ressens', '5 check-ins où tu as nommé une émotion.',          'lightbulb', 411),
  ('emotion-days-20', 'understanding', 'emotion_days', 20, true, 'Je continue à m''observer',      '20 check-ins où tu as nommé une émotion.',               'lightbulb', 412),
  -- Action : interventions TERMINÉES, quel que soit le résultat
  ('craving-interventions-1',  'action', 'craving_interventions', 1,  true, 'J''ai pris un moment',        'Une première intervention menée jusqu''au bout lors d''une envie.', 'footprints', 501),
  ('craving-interventions-3',  'action', 'craving_interventions', 3,  true, 'J''utilise mes outils',       '3 interventions menées jusqu''au bout.',                            'footprints', 502),
  ('craving-interventions-10', 'action', 'craving_interventions', 10, true, 'Je continue d''essayer',      '10 interventions menées jusqu''au bout.',                           'footprints', 503),
  ('craving-interventions-25', 'action', 'craving_interventions', 25, true, 'Je connais mieux mes options', '25 interventions menées jusqu''au bout.',                          'compass',    504),
  ('strategies-tried-3', 'action', 'strategies_tried', 3, true, 'J''explore mes options',      '3 stratégies différentes essayées lors d''interventions.', 'compass', 511),
  ('strategies-tried-5', 'action', 'strategies_tried', 5, true, 'Je découvre ce qui m''aide',  '5 stratégies différentes essayées lors d''interventions.', 'compass', 512),
  -- Mon plan : préparation (jamais une obligation)
  ('plan-reason',        'plan', 'plan_reason',      1, false, 'Je sais pourquoi',         'Ta raison principale est écrite dans ton plan.',           'heart-handshake', 601),
  ('plan-motivations-3', 'plan', 'plan_motivations', 3, true,  'Mes repères',              '3 motivations choisies dans ton plan.',                    'heart-handshake', 602),
  ('plan-triggers-3',    'plan', 'plan_triggers',    3, true,  'Je garde l''œil ouvert',    '3 déclencheurs personnels dans ton plan.',                 'map',             603),
  ('plan-strategies-3',  'plan', 'plan_strategies',  3, true,  'Ma boîte à outils',        '3 stratégies personnelles dans ton plan.',                 'map',             604),
  ('plan-support',       'plan', 'plan_support',     1, false, 'Je ne suis pas seul',      'Une personne de soutien dans ton plan.',                   'users',           605),
  ('plan-safe-place',    'plan', 'plan_safe_places', 1, false, 'Un endroit où aller',      'Un lieu sûr dans ton plan.',                               'map-pin',         606),
  ('plan-reminder',      'plan', 'plan_reminder',    1, false, 'Mon rappel',               'Un rappel personnel écrit pour les moments difficiles.',   'message-square',  607),
  ('plan-letter',        'plan', 'plan_letter',      1, false, 'Quelques mots pour moi',   'Une lettre à toi-même écrite dans un moment plus calme.',  'mail',            608),
  ('plan-taking-shape',  'plan', 'plan_elements',    5, true,  'Mon plan prend forme',     '5 éléments différents dans ton plan.',                     'map',             609)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- Accomplissements obtenus : événements historiques (jamais retirés, jamais recalculés)
-- metadata : seulement { threshold, metric, date_source } — aucun contenu personnel.
-- -----------------------------------------------------------------------------
create table public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_definition_id uuid not null references public.achievement_definitions (id),
  earned_at timestamptz not null,
  metadata jsonb,
  created_at timestamptz not null default now(),

  constraint user_achievements_unique unique (user_id, achievement_definition_id)
);

-- « Derniers accomplissements » : WHERE user_id = … ORDER BY earned_at DESC.
create index user_achievements_user_earned_idx on public.user_achievements (user_id, earned_at desc);

-- -----------------------------------------------------------------------------
-- Métriques (calculées à la volée, jamais persistées). Une ligne par position atteinte :
-- (metric, pos, reached_at) — reached_at = instant où la position a été atteinte
-- (completed_at du N-ième élément), NULL si l'historique ne permet pas de le savoir.
-- Définitions identiques à l'application :
-- - journée sobre = check-in TERMINÉ « sober » ou « sober_with_craving » (ADR-041) ;
-- - série = journées sobres enregistrées depuis la dernière consommation, journées sans
--   check-in ignorées (ADR-042, calculateStreaks) ;
-- - intervention = moment d'envie « completed », quel que soit le résultat (ADR-072).
-- INTERNE : jamais exécutable par les rôles de l'application (lit tout utilisateur).
-- -----------------------------------------------------------------------------
create or replace function public.achievement_metric_events(p_user_id uuid)
returns table (metric text, pos integer, reached_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  with checkins as (
    select c.id, c.checkin_date, c.status, c.completed_at,
           coalesce(btrim(c.victory_text), '') <> '' as has_victory,
           (coalesce(btrim(c.victory_text), '') <> '' or coalesce(btrim(c.proud_of_text), '') <> ''
            or coalesce(btrim(c.lesson_text), '') <> '' or coalesce(btrim(c.tomorrow_intention_text), '') <> ''
            or coalesce(btrim(c.notes), '') <> '') as has_reflection,
           exists (select 1 from public.checkin_triggers t where t.checkin_id = c.id) as has_trigger,
           exists (select 1 from public.checkin_emotions e where e.checkin_id = c.id) as has_emotion
      from public.daily_checkins c
     where c.user_id = p_user_id and c.completed_at is not null
  ),
  streak_groups as (
    select checkin_date, status, completed_at,
           sum(case when status = 'consumed' then 1 else 0 end)
             over (order by checkin_date rows between unbounded preceding and current row) as grp
      from checkins
  ),
  streaks as (
    select row_number() over (partition by grp order by checkin_date) as pos,
           max(completed_at) over (partition by grp order by checkin_date rows between unbounded preceding and current row) as reach
      from streak_groups
     where status <> 'consumed'
  ),
  cravings as (
    select e.completed_at,
           coalesce(i.strategy_id::text, 'custom:' || lower(btrim(i.custom_strategy_text))) as strategy_key
      from public.craving_events e
      left join public.craving_interventions i on i.craving_event_id = e.id
     where e.user_id = p_user_id and e.status = 'completed'
  ),
  strategy_first as (
    select strategy_key, min(completed_at) as first_at from cravings where strategy_key is not null group by strategy_key
  ),
  plan as (
    select
      (select count(*) from public.personal_reasons r where r.user_id = p_user_id)::int as reasons,
      (select count(*) from public.user_motivations m where m.user_id = p_user_id)::int as motivations,
      (select count(*) from public.user_personal_triggers t where t.user_id = p_user_id and t.is_active)::int as triggers,
      (select count(*) from public.user_personal_strategies s where s.user_id = p_user_id and s.is_active)::int as strategies,
      (select count(*) from public.support_contacts s where s.user_id = p_user_id)::int as contacts,
      (select count(*) from public.safe_places p where p.user_id = p_user_id and p.is_active)::int as places,
      (select count(*) from public.personal_reminders r where r.user_id = p_user_id)::int as reminders,
      (select count(*) from public.self_letters l where l.user_id = p_user_id)::int as letters
  ),
  plan_values (metric, value) as (
    select 'plan_reason', least(reasons, 1) from plan
    union all select 'plan_motivations', motivations from plan
    union all select 'plan_triggers', triggers from plan
    union all select 'plan_strategies', strategies from plan
    union all select 'plan_support', contacts from plan
    union all select 'plan_safe_places', places from plan
    union all select 'plan_reminder', least(reminders, 1) from plan
    union all select 'plan_letter', least(letters, 1) from plan
    union all select 'plan_elements',
      (reasons > 0)::int + (motivations > 0)::int + (triggers > 0)::int + (strategies > 0)::int
      + (contacts > 0)::int + (places > 0)::int + (reminders > 0)::int + (letters > 0)::int from plan
  )
  select 'checkins', (row_number() over (order by completed_at, id))::int, completed_at from checkins
  union all
  select 'sober_days', (row_number() over (order by completed_at, id))::int, completed_at from checkins where status <> 'consumed'
  union all
  select 'reflection_days', (row_number() over (order by completed_at, id))::int, completed_at from checkins where has_reflection
  union all
  select 'victory_days', (row_number() over (order by completed_at, id))::int, completed_at from checkins where has_victory
  union all
  select 'trigger_days', (row_number() over (order by completed_at, id))::int, completed_at from checkins where has_trigger
  union all
  select 'emotion_days', (row_number() over (order by completed_at, id))::int, completed_at from checkins where has_emotion
  union all
  -- Série : position k atteinte au plus tôt dans n'importe quelle série.
  select 'best_streak', pos::int, min(reach) from streaks group by pos
  union all
  select 'craving_interventions', (row_number() over (order by completed_at))::int, completed_at from cravings
  union all
  select 'strategies_tried', (row_number() over (order by first_at, strategy_key))::int, first_at from strategy_first
  union all
  -- Plan : pas d'historique fiable du moment exact → reached_at NULL (date d'attribution).
  select pv.metric, g.pos, null::timestamptz
    from plan_values pv
    cross join lateral generate_series(1, pv.value) as g(pos);
$$;

revoke execute on function public.achievement_metric_events(uuid) from public, anon, authenticated;

/**
 * Attribution (INTERNE) : insère les accomplissements satisfaits et pas encore obtenus.
 * earned_at = instant où le seuil a été atteint si l'historique le permet (date_source
 * « exact »), sinon maintenant (« attribution »). Idempotente : contrainte unique +
 * ON CONFLICT DO NOTHING (deux évaluations simultanées ne créent jamais de doublon).
 */
create or replace function public.award_achievements_for(p_user_id uuid)
returns table (slug text, earned_at timestamptz)
language sql
volatile
security invoker
set search_path = ''
as $$
  with events as (
    select * from public.achievement_metric_events(p_user_id)
  ),
  satisfied as (
    select d.id, d.slug, d.metric, d.threshold, ev.reached_at
      from public.achievement_definitions d
      join events ev on ev.metric = d.metric and ev.pos = d.threshold
     where d.is_active
  ),
  inserted as (
    insert into public.user_achievements (user_id, achievement_definition_id, earned_at, metadata)
    select p_user_id, s.id, coalesce(s.reached_at, now()),
           jsonb_build_object(
             'metric', s.metric,
             'threshold', s.threshold,
             'date_source', case when s.reached_at is null then 'attribution' else 'exact' end
           )
      from satisfied s
    on conflict (user_id, achievement_definition_id) do nothing
    returning achievement_definition_id, earned_at
  )
  select d.slug, i.earned_at
    from inserted i
    join public.achievement_definitions d on d.id = i.achievement_definition_id
   order by d.sort_order;
$$;

revoke execute on function public.award_achievements_for(uuid) from public, anon, authenticated;

/**
 * Point d'entrée de l'application (ADR-073). SECURITY DEFINER EXTRÊMEMENT CIBLÉ :
 * aucun paramètre (l'utilisateur est toujours auth.uid(), jamais choisi par le client),
 * search_path vide, n'insère QUE les accomplissements dont le critère est satisfait
 * par les données de l'utilisateur. Retourne les nouveaux et indique s'il s'agit de la
 * première attribution (rattrapage de l'historique, affiché en une seule synthèse).
 */
create or replace function public.award_achievements()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_had_any boolean;
  v_new jsonb;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  -- Sérialise les évaluations simultanées d'un même utilisateur (la contrainte unique suffit
  -- contre les doublons ; le verrou rend « initial » fiable).
  perform pg_advisory_xact_lock(hashtext('award_achievements' || v_user_id::text));
  select exists (select 1 from public.user_achievements ua where ua.user_id = v_user_id) into v_had_any;

  select coalesce(jsonb_agg(jsonb_build_object('slug', a.slug, 'earnedAt', a.earned_at)), '[]'::jsonb)
    into v_new
    from public.award_achievements_for(v_user_id) a;

  return jsonb_build_object('awarded', v_new, 'initial', not v_had_any);
end;
$$;

/** Valeurs actuelles des métriques de l'utilisateur courant (progression « 42 / 60 »). */
create or replace function public.get_achievement_progress()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(m.metric, m.value), '{}'::jsonb)
    from (
      select ev.metric, max(ev.pos) as value
        from public.achievement_metric_events((select auth.uid())) ev
       where (select auth.uid()) is not null
       group by ev.metric
    ) m;
$$;

revoke execute on function public.award_achievements() from public, anon;
revoke execute on function public.get_achievement_progress() from public, anon;
grant execute on function public.award_achievements() to authenticated;
grant execute on function public.get_achievement_progress() to authenticated;

-- -----------------------------------------------------------------------------
-- Privilèges et RLS : catalogue en lecture ; accomplissements en LECTURE SEULE pour
-- l'utilisateur (aucune insertion, modification ni suppression depuis l'application).
-- -----------------------------------------------------------------------------
revoke all on table public.achievement_definitions from anon, authenticated;
grant select on table public.achievement_definitions to authenticated;

revoke all on table public.user_achievements from anon, authenticated;
grant select on table public.user_achievements to authenticated;

alter table public.achievement_definitions enable row level security;
create policy "achievement_definitions_select_active" on public.achievement_definitions
  for select to authenticated using (is_active);

alter table public.user_achievements enable row level security;
create policy "user_achievements_select_own" on public.user_achievements
  for select to authenticated using ((select auth.uid()) = user_id);
