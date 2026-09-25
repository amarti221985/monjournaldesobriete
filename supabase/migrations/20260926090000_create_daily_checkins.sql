-- =============================================================================
-- Sprint 3 — Check-in quotidien
--
-- - public.checkin_status                 : sober | sober_with_craving | consumed
-- - catalogues contrôlés (lecture seule)  : emotions, trigger_types, achievement_types
-- - public.daily_checkins                 : un check-in par journée locale (brouillon si
--                                           completed_at est NULL)
-- - relations                             : checkin_emotions, checkin_triggers,
--                                           checkin_achievements, consumption_events
-- - intégrité                             : clés étrangères composites (id, user_id)
-- - cohérence statut / consommations      : triggers de contrainte différés
-- - public.save_checkin(payload, finalize): enregistrement transactionnel et idempotent
-- =============================================================================

create type public.checkin_status as enum ('sober', 'sober_with_craving', 'consumed');

-- -----------------------------------------------------------------------------
-- Catalogues contrôlés (ADR-038). Modifiés uniquement par migration.
-- « trigger_types » plutôt que « triggers » : évite la confusion avec les
-- triggers PostgreSQL.
-- -----------------------------------------------------------------------------
create table public.emotions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_fr text not null,
  category text not null,
  sort_order smallint not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint emotions_slug_format check (slug ~ '^[a-z][a-z0-9_]{1,39}$'),
  constraint emotions_name_length check (char_length(name_fr) between 1 and 60),
  constraint emotions_category_valid check (category in ('positive', 'difficult'))
);

create table public.trigger_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_fr text not null,
  sort_order smallint not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint trigger_types_slug_format check (slug ~ '^[a-z][a-z0-9_]{1,39}$'),
  constraint trigger_types_name_length check (char_length(name_fr) between 1 and 60)
);

create table public.achievement_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_fr text not null,
  sort_order smallint not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint achievement_types_slug_format check (slug ~ '^[a-z][a-z0-9_]{1,39}$'),
  constraint achievement_types_name_length check (char_length(name_fr) between 1 and 60)
);

-- Émotions nommées par des noms communs (« Joie », « Fierté ») : aucun accord de genre.
insert into public.emotions (slug, name_fr, category, sort_order) values
  ('joy',          'Joie',          'positive',  1),
  ('calm',         'Calme',         'positive',  2),
  ('pride',        'Fierté',        'positive',  3),
  ('motivation',   'Motivation',    'positive',  4),
  ('gratitude',    'Gratitude',     'positive',  5),
  ('confidence',   'Confiance',     'positive',  6),
  ('relief',       'Soulagement',   'positive',  7),
  ('stress',       'Stress',        'difficult', 8),
  ('anxiety',      'Anxiété',       'difficult', 9),
  ('sadness',      'Tristesse',     'difficult', 10),
  ('loneliness',   'Solitude',      'difficult', 11),
  ('boredom',      'Ennui',         'difficult', 12),
  ('frustration',  'Frustration',   'difficult', 13),
  ('anger',        'Colère',        'difficult', 14),
  ('fatigue',      'Fatigue',       'difficult', 15);

insert into public.trigger_types (slug, name_fr, sort_order) values
  ('stress',        'Stress',            1),
  ('work',          'Travail',           2),
  ('money',         'Argent',            3),
  ('relationships', 'Relations',         4),
  ('loneliness',    'Solitude',          5),
  ('boredom',       'Ennui',             6),
  ('fatigue',       'Fatigue',           7),
  ('conflict',      'Conflit',           8),
  ('social_event',  'Événement social',  9),
  ('person',        'Une personne',      10),
  ('place',         'Un lieu',           11),
  ('memory',        'Un souvenir',       12),
  ('other',         'Autre',             13);

insert into public.achievement_types (slug, name_fr, sort_order) values
  ('goals',            'Travaillé sur mes objectifs',           1),
  ('exercise',         'Activité physique',                     2),
  ('ate_well',         'Bien mangé',                            3),
  ('self_care',        'Pris soin de moi',                      4),
  ('connected',        'Vu ou parlé à quelqu''un',              5),
  ('work_win',         'Accompli quelque chose au travail',     6),
  ('personal_project', 'Avancé un projet personnel',            7),
  ('asked_for_help',   'Demandé de l''aide',                    8),
  ('resisted_craving', 'Résisté à une envie',                   9),
  ('slept_well',       'Bien dormi',                            10),
  ('other',            'Autre',                                 11);

-- -----------------------------------------------------------------------------
-- Check-in quotidien (ADR-034, ADR-035)
-- -----------------------------------------------------------------------------
create table public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Journée locale de l'utilisateur (jamais dérivée d'un timestamp UTC).
  checkin_date date not null,
  status public.checkin_status not null,

  mood_score smallint,
  energy_score smallint,
  stress_score smallint,
  -- Envie globale de la journée (≠ consumption_events.craving_before, ADR-037).
  craving_score smallint,

  victory_text text,
  proud_of_text text,
  lesson_text text,
  tomorrow_intention_text text,
  notes text,

  -- NULL = brouillon. Seuls les check-ins terminés alimentent les statistiques (ADR-039).
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint daily_checkins_one_per_day unique (user_id, checkin_date),
  -- Cible des clés étrangères composites des tables liées.
  constraint daily_checkins_id_user_unique unique (id, user_id),
  constraint daily_checkins_date_range check (checkin_date >= date '1900-01-01'),
  constraint daily_checkins_mood_range check (mood_score between 1 and 10),
  constraint daily_checkins_energy_range check (energy_score between 1 and 10),
  constraint daily_checkins_stress_range check (stress_score between 1 and 10),
  constraint daily_checkins_craving_range check (craving_score between 0 and 10),
  constraint daily_checkins_victory_length check (char_length(victory_text) between 1 and 1000),
  constraint daily_checkins_proud_length check (char_length(proud_of_text) between 1 and 2000),
  constraint daily_checkins_lesson_length check (char_length(lesson_text) between 1 and 2000),
  constraint daily_checkins_intention_length check (char_length(tomorrow_intention_text) between 1 and 1000),
  constraint daily_checkins_notes_length check (char_length(notes) between 1 and 5000),
  -- Un check-in terminé a toujours ses quatre scores.
  constraint daily_checkins_completed_requires_scores check (
    completed_at is null
    or (mood_score is not null and energy_score is not null
        and stress_score is not null and craving_score is not null)
  )
);

-- Pas d'index supplémentaire : (user_id, checkin_date) est déjà indexé par la
-- contrainte unique et couvre les lectures par utilisateur et par période.

create trigger daily_checkins_set_updated_at
  before update on public.daily_checkins
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Relations du check-in (ADR-036). user_id + clé étrangère composite
-- (checkin_id, user_id) : RLS simple ET impossibilité de rattacher une ligne au
-- check-in d'un autre utilisateur.
-- -----------------------------------------------------------------------------
create table public.checkin_emotions (
  checkin_id uuid not null,
  user_id uuid not null default auth.uid(),
  emotion_id uuid not null references public.emotions (id),
  created_at timestamptz not null default now(),
  primary key (checkin_id, emotion_id),
  foreign key (checkin_id, user_id)
    references public.daily_checkins (id, user_id) on delete cascade
);

create table public.checkin_triggers (
  checkin_id uuid not null,
  user_id uuid not null default auth.uid(),
  trigger_type_id uuid not null references public.trigger_types (id),
  custom_label text,
  created_at timestamptz not null default now(),
  primary key (checkin_id, trigger_type_id),
  foreign key (checkin_id, user_id)
    references public.daily_checkins (id, user_id) on delete cascade,
  constraint checkin_triggers_custom_label_valid check (
    custom_label is null or (char_length(custom_label) between 1 and 80 and custom_label = btrim(custom_label))
  )
);

create table public.checkin_achievements (
  checkin_id uuid not null,
  user_id uuid not null default auth.uid(),
  achievement_type_id uuid not null references public.achievement_types (id),
  custom_label text,
  created_at timestamptz not null default now(),
  primary key (checkin_id, achievement_type_id),
  foreign key (checkin_id, user_id)
    references public.daily_checkins (id, user_id) on delete cascade,
  constraint checkin_achievements_custom_label_valid check (
    custom_label is null or (char_length(custom_label) between 1 and 80 and custom_label = btrim(custom_label))
  )
);

-- Index sur user_id pour la RLS et les futures lectures par utilisateur.
create index checkin_emotions_user_id_idx on public.checkin_emotions (user_id);
create index checkin_triggers_user_id_idx on public.checkin_triggers (user_id);
create index checkin_achievements_user_id_idx on public.checkin_achievements (user_id);

-- -----------------------------------------------------------------------------
-- Événements de consommation (ADR-037)
-- La substance doit appartenir au même utilisateur : clé étrangère composite
-- vers user_substances (id, user_id). Supprimer un check-in supprime ses
-- événements ; une substance suivie n'est jamais supprimée en cascade.
-- -----------------------------------------------------------------------------
alter table public.user_substances
  add constraint user_substances_id_user_unique unique (id, user_id);

create table public.consumption_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  checkin_id uuid not null,
  user_substance_id uuid not null,

  -- Précision facultative : aucune valeur n'est exigée ni inventée.
  quantity numeric(10, 2),
  unit text,
  -- Heure locale approximative ; la date est celle du check-in.
  occurred_at time,
  craving_before smallint,

  context_text text,
  reflection_text text,
  next_time_strategy_text text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  foreign key (checkin_id, user_id)
    references public.daily_checkins (id, user_id) on delete cascade,
  foreign key (user_substance_id, user_id)
    references public.user_substances (id, user_id),

  constraint consumption_events_quantity_range check (quantity > 0 and quantity <= 10000),
  constraint consumption_events_unit_length check (char_length(unit) between 1 and 40),
  constraint consumption_events_craving_range check (craving_before between 0 and 10),
  constraint consumption_events_context_length check (char_length(context_text) between 1 and 2000),
  constraint consumption_events_reflection_length check (char_length(reflection_text) between 1 and 2000),
  constraint consumption_events_strategy_length check (char_length(next_time_strategy_text) between 1 and 2000)
);

create index consumption_events_checkin_id_idx on public.consumption_events (checkin_id);
create index consumption_events_user_id_idx on public.consumption_events (user_id);
create index consumption_events_user_substance_id_idx on public.consumption_events (user_substance_id);

create trigger consumption_events_set_updated_at
  before update on public.consumption_events
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Cohérence statut / consommations (ADR-037)
-- Pour un check-in TERMINÉ : status = 'consumed' ⇔ au moins un événement.
-- Triggers de contrainte DIFFÉRÉS : vérifiés à la fin de la transaction, ce qui
-- permet à save_checkin() de réécrire statut et événements atomiquement, et
-- bloque tout état contradictoire créé par un autre chemin d'écriture.
-- -----------------------------------------------------------------------------
create or replace function public.check_checkin_consumption_consistency()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_checkin_id uuid;
  v_status public.checkin_status;
  v_completed_at timestamptz;
  v_has_events boolean;
begin
  if tg_table_name = 'daily_checkins' then
    v_checkin_id := new.id;
  elsif tg_op = 'DELETE' then
    v_checkin_id := old.checkin_id;
  else
    v_checkin_id := new.checkin_id;
  end if;

  select c.status, c.completed_at
    into v_status, v_completed_at
    from public.daily_checkins c
   where c.id = v_checkin_id;

  -- Check-in supprimé (cascade) ou brouillon : rien à vérifier.
  if not found or v_completed_at is null then
    return null;
  end if;

  select exists (
    select 1 from public.consumption_events e where e.checkin_id = v_checkin_id
  ) into v_has_events;

  if (v_status = 'consumed') is distinct from v_has_events then
    raise exception 'checkin_consumption_inconsistent'
      using errcode = '23514',
            hint = 'Un check-in « consumed » terminé exige au moins une consommation ; les autres n''en ont aucune.';
  end if;

  return null;
end;
$$;

revoke execute on function public.check_checkin_consumption_consistency() from public, anon, authenticated;

create constraint trigger daily_checkins_consumption_consistency
  after insert or update on public.daily_checkins
  deferrable initially deferred
  for each row execute function public.check_checkin_consumption_consistency();

create constraint trigger consumption_events_consistency
  after insert or update or delete on public.consumption_events
  deferrable initially deferred
  for each row execute function public.check_checkin_consumption_consistency();

-- -----------------------------------------------------------------------------
-- Enregistrement transactionnel et idempotent (ADR-035)
--
-- finalize = false : sauvegarde du brouillon (refusée si le check-in est déjà
--                    terminé, pour ne jamais le « dé-terminer »).
-- finalize = true  : validation complète, synchronisation des relations,
--                    completed_at conservé s'il existait déjà (modification).
--
-- SECURITY INVOKER : la RLS et les privilèges de l'utilisateur s'appliquent à
-- toutes les écritures. Les relations sont remplacées (supprimer + insérer) :
-- une double soumission produit exactement le même état.
-- -----------------------------------------------------------------------------
create or replace function public.save_checkin(payload jsonb, finalize boolean default false)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_timezone text;
  v_latest_today date;
  v_date date;
  v_status public.checkin_status;
  v_existing public.daily_checkins%rowtype;
  v_checkin public.daily_checkins%rowtype;
  v_mood smallint;
  v_energy smallint;
  v_stress smallint;
  v_craving smallint;
  v_item jsonb;
  v_slug text;
  v_label text;
  v_catalogue_id uuid;
  v_event_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if jsonb_typeof(payload) is distinct from 'object' then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  -- Journée : jamais dans le futur selon le fuseau du profil (sinon fuseau le plus en avance).
  select p.timezone into v_timezone from public.profiles p where p.id = v_user_id;
  v_latest_today := (now() at time zone coalesce(v_timezone, 'Pacific/Kiritimati'))::date;
  begin
    v_date := (payload ->> 'checkinDate')::date;
  exception when others then
    raise exception 'invalid_checkin_date' using errcode = '22023';
  end;
  if v_date is null or v_date > v_latest_today or v_date < date '1900-01-01' then
    raise exception 'invalid_checkin_date' using errcode = '22023';
  end if;

  begin
    v_status := (payload ->> 'status')::public.checkin_status;
    v_mood := (payload ->> 'moodScore')::smallint;
    v_energy := (payload ->> 'energyScore')::smallint;
    v_stress := (payload ->> 'stressScore')::smallint;
    v_craving := (payload ->> 'cravingScore')::smallint;
  exception when others then
    raise exception 'invalid_values' using errcode = '22023';
  end;
  if v_status is null then
    raise exception 'invalid_status' using errcode = '22023';
  end if;

  -- Verrou : deux soumissions simultanées pour la même journée sont sérialisées.
  select * into v_existing
    from public.daily_checkins c
   where c.user_id = v_user_id and c.checkin_date = v_date
   for update;

  if found and v_existing.completed_at is not null and not finalize then
    raise exception 'checkin_already_completed' using errcode = 'P0001';
  end if;

  if finalize and (v_mood is null or v_energy is null or v_stress is null or v_craving is null) then
    raise exception 'missing_scores' using errcode = '22023';
  end if;

  -- Les contraintes CHECK de la table valident les bornes et longueurs.
  insert into public.daily_checkins as c (
    user_id, checkin_date, status, mood_score, energy_score, stress_score, craving_score,
    victory_text, proud_of_text, lesson_text, tomorrow_intention_text, notes
  ) values (
    v_user_id, v_date, v_status, v_mood, v_energy, v_stress, v_craving,
    nullif(btrim(payload ->> 'victoryText'), ''),
    nullif(btrim(payload ->> 'proudOfText'), ''),
    nullif(btrim(payload ->> 'lessonText'), ''),
    nullif(btrim(payload ->> 'tomorrowIntentionText'), ''),
    nullif(btrim(payload ->> 'notes'), '')
  )
  on conflict (user_id, checkin_date) do update set
    status = excluded.status,
    mood_score = excluded.mood_score,
    energy_score = excluded.energy_score,
    stress_score = excluded.stress_score,
    craving_score = excluded.craving_score,
    victory_text = excluded.victory_text,
    proud_of_text = excluded.proud_of_text,
    lesson_text = excluded.lesson_text,
    tomorrow_intention_text = excluded.tomorrow_intention_text,
    notes = excluded.notes
  returning * into v_checkin;

  -- Émotions ---------------------------------------------------------------
  delete from public.checkin_emotions where checkin_id = v_checkin.id;
  if jsonb_typeof(coalesce(payload -> 'emotions', '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(payload -> 'emotions', '[]'::jsonb)) > 20 then
    raise exception 'invalid_emotions' using errcode = '22023';
  end if;
  for v_item in select * from jsonb_array_elements(coalesce(payload -> 'emotions', '[]'::jsonb)) loop
    select e.id into v_catalogue_id from public.emotions e
     where e.slug = v_item #>> '{}' and e.is_active;
    if not found then
      raise exception 'invalid_emotions' using errcode = '22023';
    end if;
    insert into public.checkin_emotions (checkin_id, user_id, emotion_id)
    values (v_checkin.id, v_user_id, v_catalogue_id)
    on conflict do nothing;
  end loop;

  -- Déclencheurs (précision seulement pour « other ») ------------------------
  delete from public.checkin_triggers where checkin_id = v_checkin.id;
  if jsonb_typeof(coalesce(payload -> 'triggers', '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(payload -> 'triggers', '[]'::jsonb)) > 20 then
    raise exception 'invalid_triggers' using errcode = '22023';
  end if;
  for v_item in select * from jsonb_array_elements(coalesce(payload -> 'triggers', '[]'::jsonb)) loop
    v_slug := v_item ->> 'slug';
    select t.id into v_catalogue_id from public.trigger_types t
     where t.slug = v_slug and t.is_active;
    if not found then
      raise exception 'invalid_triggers' using errcode = '22023';
    end if;
    v_label := case when v_slug = 'other' then nullif(btrim(v_item ->> 'customLabel'), '') end;
    insert into public.checkin_triggers (checkin_id, user_id, trigger_type_id, custom_label)
    values (v_checkin.id, v_user_id, v_catalogue_id, v_label)
    on conflict do nothing;
  end loop;

  -- Accomplissements (précision seulement pour « other ») --------------------
  delete from public.checkin_achievements where checkin_id = v_checkin.id;
  if jsonb_typeof(coalesce(payload -> 'achievements', '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(payload -> 'achievements', '[]'::jsonb)) > 20 then
    raise exception 'invalid_achievements' using errcode = '22023';
  end if;
  for v_item in select * from jsonb_array_elements(coalesce(payload -> 'achievements', '[]'::jsonb)) loop
    v_slug := v_item ->> 'slug';
    select a.id into v_catalogue_id from public.achievement_types a
     where a.slug = v_slug and a.is_active;
    if not found then
      raise exception 'invalid_achievements' using errcode = '22023';
    end if;
    v_label := case when v_slug = 'other' then nullif(btrim(v_item ->> 'customLabel'), '') end;
    insert into public.checkin_achievements (checkin_id, user_id, achievement_type_id, custom_label)
    values (v_checkin.id, v_user_id, v_catalogue_id, v_label)
    on conflict do nothing;
  end loop;

  -- Consommations : remplacées ; seulement si le statut est « consumed » ------
  delete from public.consumption_events where checkin_id = v_checkin.id;
  if jsonb_typeof(coalesce(payload -> 'consumptionEvents', '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(payload -> 'consumptionEvents', '[]'::jsonb)) > 10 then
    raise exception 'invalid_consumption_events' using errcode = '22023';
  end if;

  if v_status = 'consumed' then
    for v_item in select * from jsonb_array_elements(coalesce(payload -> 'consumptionEvents', '[]'::jsonb)) loop
      -- Substance suivie ET active de l'utilisateur (la clé composite garantit la propriété).
      if not exists (
        select 1 from public.user_substances us
         where us.id = (v_item ->> 'userSubstanceId')::uuid
           and us.user_id = v_user_id
           and us.is_active
      ) then
        raise exception 'invalid_consumption_events' using errcode = '22023';
      end if;

      insert into public.consumption_events (
        user_id, checkin_id, user_substance_id, quantity, unit, occurred_at, craving_before,
        context_text, reflection_text, next_time_strategy_text
      ) values (
        v_user_id,
        v_checkin.id,
        (v_item ->> 'userSubstanceId')::uuid,
        (v_item ->> 'quantity')::numeric,
        nullif(btrim(v_item ->> 'unit'), ''),
        (v_item ->> 'occurredAt')::time,
        (v_item ->> 'cravingBefore')::smallint,
        nullif(btrim(v_item ->> 'contextText'), ''),
        nullif(btrim(v_item ->> 'reflectionText'), ''),
        nullif(btrim(v_item ->> 'nextTimeStrategyText'), '')
      );
      v_event_count := v_event_count + 1;
    end loop;
  elsif finalize and jsonb_array_length(coalesce(payload -> 'consumptionEvents', '[]'::jsonb)) > 0 then
    raise exception 'consumption_events_not_allowed' using errcode = '22023';
  end if;

  if finalize then
    if v_status = 'consumed' and v_event_count = 0 then
      raise exception 'consumption_event_required' using errcode = '22023';
    end if;
    update public.daily_checkins
       set completed_at = coalesce(completed_at, now())
     where id = v_checkin.id
    returning * into v_checkin;
  end if;

  return jsonb_build_object(
    'id', v_checkin.id,
    'checkinDate', v_checkin.checkin_date,
    'completed', v_checkin.completed_at is not null
  );
end;
$$;

comment on function public.save_checkin(jsonb, boolean) is
  'Enregistre (brouillon) ou finalise le check-in de l''utilisateur courant, de façon atomique.';

revoke execute on function public.save_checkin(jsonb, boolean) from public, anon;
grant execute on function public.save_checkin(jsonb, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- Privilèges (least privilege)
-- -----------------------------------------------------------------------------
revoke all on table public.emotions, public.trigger_types, public.achievement_types from anon, authenticated;
grant select on table public.emotions, public.trigger_types, public.achievement_types to authenticated;

revoke all on table public.daily_checkins from anon, authenticated;
grant select, insert, delete on table public.daily_checkins to authenticated;
grant update (
  status, mood_score, energy_score, stress_score, craving_score,
  victory_text, proud_of_text, lesson_text, tomorrow_intention_text, notes, completed_at
) on table public.daily_checkins to authenticated;

revoke all on table public.checkin_emotions, public.checkin_triggers, public.checkin_achievements
  from anon, authenticated;
grant select, insert, delete on table public.checkin_emotions, public.checkin_triggers, public.checkin_achievements
  to authenticated;

revoke all on table public.consumption_events from anon, authenticated;
grant select, insert, delete on table public.consumption_events to authenticated;
grant update (
  user_substance_id, quantity, unit, occurred_at, craving_before,
  context_text, reflection_text, next_time_strategy_text
) on table public.consumption_events to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.emotions enable row level security;
alter table public.trigger_types enable row level security;
alter table public.achievement_types enable row level security;
create policy "emotions_select_active" on public.emotions
  for select to authenticated using (is_active);
create policy "trigger_types_select_active" on public.trigger_types
  for select to authenticated using (is_active);
create policy "achievement_types_select_active" on public.achievement_types
  for select to authenticated using (is_active);

alter table public.daily_checkins enable row level security;
create policy "daily_checkins_select_own" on public.daily_checkins
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "daily_checkins_insert_own" on public.daily_checkins
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "daily_checkins_update_own" on public.daily_checkins
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- Suppression limitée aux brouillons (« Recommencer ») : un check-in terminé fait
-- partie de l'historique (la suppression de compte passera par la cascade).
create policy "daily_checkins_delete_own_draft" on public.daily_checkins
  for delete to authenticated using ((select auth.uid()) = user_id and completed_at is null);

alter table public.checkin_emotions enable row level security;
create policy "checkin_emotions_select_own" on public.checkin_emotions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "checkin_emotions_insert_own" on public.checkin_emotions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "checkin_emotions_delete_own" on public.checkin_emotions
  for delete to authenticated using ((select auth.uid()) = user_id);

alter table public.checkin_triggers enable row level security;
create policy "checkin_triggers_select_own" on public.checkin_triggers
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "checkin_triggers_insert_own" on public.checkin_triggers
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "checkin_triggers_delete_own" on public.checkin_triggers
  for delete to authenticated using ((select auth.uid()) = user_id);

alter table public.checkin_achievements enable row level security;
create policy "checkin_achievements_select_own" on public.checkin_achievements
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "checkin_achievements_insert_own" on public.checkin_achievements
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "checkin_achievements_delete_own" on public.checkin_achievements
  for delete to authenticated using ((select auth.uid()) = user_id);

alter table public.consumption_events enable row level security;
create policy "consumption_events_select_own" on public.consumption_events
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "consumption_events_insert_own" on public.consumption_events
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "consumption_events_update_own" on public.consumption_events
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "consumption_events_delete_own" on public.consumption_events
  for delete to authenticated using ((select auth.uid()) = user_id);
