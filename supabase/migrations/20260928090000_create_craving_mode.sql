-- =============================================================================
-- Sprint 7 — Mode « J'ai envie de consommer »
--
-- - public.craving_event_status        : in_progress | completed | abandoned
-- - public.craving_strategies          : catalogue contrôlé (lecture seule)
-- - public.craving_events              : un moment d'envie (plusieurs par journée),
--                                        indépendant du check-in quotidien (ADR-057)
-- - relations                          : craving_event_substances, craving_event_emotions,
--                                        craving_event_triggers
-- - public.craving_interventions       : la stratégie essayée et son minuteur (une
--                                        intervention principale par moment en V1, ADR-059)
-- - écritures                          : RPC transactionnelles SECURITY INVOKER (RLS)
-- =============================================================================

create type public.craving_event_status as enum ('in_progress', 'completed', 'abandoned');

-- -----------------------------------------------------------------------------
-- Catalogue des stratégies (modifié uniquement par migration). « Ma propre
-- stratégie » n'est pas une ligne : c'est strategy_id NULL + texte personnel.
-- -----------------------------------------------------------------------------
create table public.craving_strategies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_fr text not null,
  description_fr text not null,
  default_duration_minutes smallint,
  sort_order smallint not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),

  constraint craving_strategies_slug_format check (slug ~ '^[a-z][a-z0-9_]{1,39}$'),
  constraint craving_strategies_duration_range check (
    default_duration_minutes is null or default_duration_minutes between 1 and 120
  )
);

insert into public.craving_strategies (slug, name_fr, description_fr, default_duration_minutes, sort_order) values
  ('change_environment', 'Changer d''environnement',
   'Va dans une autre pièce, sors dehors ou éloigne-toi temporairement du contexte.', 10, 1),
  ('walk', 'Marcher', 'Prends quelques minutes pour bouger et changer de rythme.', 10, 2),
  ('drink_or_eat', 'Boire ou manger quelque chose',
   'Prends un verre d''eau ou quelque chose à manger si cela te convient.', 5, 3),
  ('shower', 'Prendre une douche', 'Change de sensation et prends quelques minutes pour toi.', 10, 4),
  ('music', 'Écouter de la musique', 'Choisis quelque chose qui peut t''aider à traverser le moment.', 10, 5),
  ('breathe', 'Respirer lentement', 'Prends quelques minutes pour ralentir ta respiration.', 5, 6),
  ('contact_someone', 'Contacter quelqu''un',
   'Écris ou appelle une personne avec qui tu te sens en sécurité.', 10, 7),
  ('reread_reasons', 'Relire mes raisons',
   'Reviens à ce qui compte pour toi et à la raison pour laquelle tu as commencé.', 5, 8),
  ('keep_busy', 'M''occuper autrement',
   'Choisis une activité simple qui peut déplacer ton attention pendant quelques minutes.', 15, 9);

-- -----------------------------------------------------------------------------
-- Moments d'envie
-- local_date : journée locale de DÉBUT (fuseau du profil), jamais modifiée ensuite.
-- started_at / completed_at : instants UTC réels.
-- -----------------------------------------------------------------------------
create table public.craving_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,

  local_date date not null,

  initial_craving_score smallint not null,
  final_craving_score smallint,

  -- « Je ne sais pas » : réponse valide, aucun déclencheur n'est alors enregistré.
  trigger_unknown boolean not null default false,
  context_text text,
  outcome_text text,

  status public.craving_event_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint craving_events_id_user_unique unique (id, user_id),
  constraint craving_events_date_range check (local_date >= date '2000-01-01'),
  constraint craving_events_initial_range check (initial_craving_score between 0 and 10),
  constraint craving_events_final_range check (final_craving_score between 0 and 10),
  constraint craving_events_context_length check (char_length(context_text) between 1 and 2000),
  constraint craving_events_outcome_length check (char_length(outcome_text) between 1 and 2000),
  -- Jamais « completed » sans score final ni date de fin ; les autres états n'ont pas de fin.
  constraint craving_events_completion_consistent check (
    (status = 'completed' and final_craving_score is not null and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  ),
  constraint craving_events_completed_after_start check (completed_at is null or completed_at >= started_at)
);

-- Historique récent et moment en cours : WHERE user_id = … ORDER BY started_at DESC.
create index craving_events_user_started_idx on public.craving_events (user_id, started_at desc);

create trigger craving_events_set_updated_at
  before update on public.craving_events
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Relations : user_id + clé étrangère composite (craving_event_id, user_id) —
-- impossible de rattacher une ligne au moment d'un autre utilisateur.
-- -----------------------------------------------------------------------------
create table public.craving_event_substances (
  craving_event_id uuid not null,
  user_id uuid not null default auth.uid(),
  user_substance_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (craving_event_id, user_substance_id),
  foreign key (craving_event_id, user_id)
    references public.craving_events (id, user_id) on delete cascade,
  -- La substance suivie doit appartenir au même utilisateur.
  foreign key (user_substance_id, user_id)
    references public.user_substances (id, user_id)
);

create table public.craving_event_emotions (
  craving_event_id uuid not null,
  user_id uuid not null default auth.uid(),
  emotion_id uuid not null references public.emotions (id),
  created_at timestamptz not null default now(),
  primary key (craving_event_id, emotion_id),
  foreign key (craving_event_id, user_id)
    references public.craving_events (id, user_id) on delete cascade
);

create table public.craving_event_triggers (
  craving_event_id uuid not null,
  user_id uuid not null default auth.uid(),
  trigger_type_id uuid not null references public.trigger_types (id),
  custom_label text,
  created_at timestamptz not null default now(),
  primary key (craving_event_id, trigger_type_id),
  foreign key (craving_event_id, user_id)
    references public.craving_events (id, user_id) on delete cascade,
  constraint craving_event_triggers_custom_label_valid check (
    custom_label is null or (char_length(custom_label) between 1 and 80 and custom_label = btrim(custom_label))
  )
);

create index craving_event_substances_user_id_idx on public.craving_event_substances (user_id);
create index craving_event_substances_user_substance_id_idx on public.craving_event_substances (user_substance_id);
create index craving_event_emotions_user_id_idx on public.craving_event_emotions (user_id);
create index craving_event_triggers_user_id_idx on public.craving_event_triggers (user_id);

-- -----------------------------------------------------------------------------
-- Interventions : stratégie + minuteur fondé sur des horodatages (ADR-060).
-- Temps actif = (maintenant ou fin) − started_at − paused_seconds − pause en cours.
-- -----------------------------------------------------------------------------
create table public.craving_interventions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  craving_event_id uuid not null,

  strategy_id uuid references public.craving_strategies (id),
  custom_strategy_text text,
  helped_text text,

  planned_duration_minutes smallint,
  actual_duration_seconds integer,

  started_at timestamptz not null default now(),
  paused_at timestamptz,
  paused_seconds integer not null default 0,
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  foreign key (craving_event_id, user_id)
    references public.craving_events (id, user_id) on delete cascade,

  -- Exactement une stratégie : du catalogue OU personnelle.
  constraint craving_interventions_strategy_xor check ((strategy_id is null) <> (custom_strategy_text is null)),
  constraint craving_interventions_custom_length check (
    char_length(custom_strategy_text) between 1 and 500 and custom_strategy_text = btrim(custom_strategy_text)
  ),
  constraint craving_interventions_helped_length check (char_length(helped_text) between 1 and 2000),
  constraint craving_interventions_planned_range check (planned_duration_minutes between 1 and 120),
  constraint craving_interventions_actual_range check (actual_duration_seconds between 0 and 86400),
  constraint craving_interventions_paused_range check (paused_seconds >= 0),
  constraint craving_interventions_completed_after_start check (completed_at is null or completed_at >= started_at),
  constraint craving_interventions_no_pause_after_end check (completed_at is null or paused_at is null)
);

-- V1 : une intervention principale par moment (contrainte levable plus tard).
create unique index craving_interventions_one_per_event on public.craving_interventions (craving_event_id);
create index craving_interventions_user_id_idx on public.craving_interventions (user_id);
create index craving_interventions_strategy_id_idx on public.craving_interventions (strategy_id);

create trigger craving_interventions_set_updated_at
  before update on public.craving_interventions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Fonctions (SECURITY INVOKER : RLS et privilèges de l'utilisateur s'appliquent)
-- -----------------------------------------------------------------------------

/** Journée locale actuelle de l'utilisateur courant (fuseau du profil, sinon Toronto). */
create or replace function public.current_user_local_date()
returns date
language sql
stable
security invoker
set search_path = ''
as $$
  select (now() at time zone coalesce(
    (select p.timezone from public.profiles p where p.id = (select auth.uid())),
    'America/Toronto'
  ))::date;
$$;

/**
 * Transition documentée (ADR-062) : un moment encore « in_progress » dont la journée
 * locale est passée devient « abandoned ». Il n'est jamais repris ni compté.
 */
create or replace function public.close_stale_craving_events()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  update public.craving_interventions i
     set completed_at = coalesce(i.paused_at, now()), paused_at = null
    from public.craving_events e
   where e.id = i.craving_event_id
     and e.user_id = v_user_id
     and e.status = 'in_progress'
     and e.local_date < public.current_user_local_date()
     and i.completed_at is null;

  update public.craving_events
     set status = 'abandoned'
   where user_id = v_user_id
     and status = 'in_progress'
     and local_date < public.current_user_local_date();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

/**
 * Démarre un moment d'envie avec ses relations, en une transaction. Idempotent :
 * l'identifiant est généré par le client ; un double envoi renvoie le même moment.
 */
create or replace function public.start_craving_event(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_event public.craving_events%rowtype;
  v_initial smallint;
  v_unknown boolean;
  v_item jsonb;
  v_slug text;
  v_catalogue_id uuid;
  v_substance_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if jsonb_typeof(payload) is distinct from 'object' then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;

  begin
    v_id := (payload ->> 'id')::uuid;
    v_initial := (payload ->> 'initialCravingScore')::smallint;
    v_unknown := coalesce((payload ->> 'triggerUnknown')::boolean, false);
  exception when others then
    raise exception 'invalid_values' using errcode = '22023';
  end;
  if v_id is null or v_initial is null then
    raise exception 'invalid_values' using errcode = '22023';
  end if;

  -- Double envoi : le moment existe déjà pour cet utilisateur.
  select * into v_event from public.craving_events e where e.id = v_id and e.user_id = v_user_id;
  if found then
    return jsonb_build_object('id', v_event.id, 'localDate', v_event.local_date);
  end if;

  perform public.close_stale_craving_events();

  -- Les contraintes CHECK valident les bornes et longueurs ; un identifiant déjà
  -- utilisé par un autre compte échoue sur la clé primaire (sans rien révéler).
  insert into public.craving_events (id, user_id, local_date, initial_craving_score, trigger_unknown, context_text)
  values (v_id, v_user_id, public.current_user_local_date(), v_initial, v_unknown,
          nullif(btrim(payload ->> 'contextText'), ''))
  returning * into v_event;

  -- Substances : au moins une, suivies ET actives, appartenant à l'utilisateur.
  if jsonb_typeof(coalesce(payload -> 'substanceIds', '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(payload -> 'substanceIds', '[]'::jsonb)) > 10 then
    raise exception 'invalid_substances' using errcode = '22023';
  end if;
  for v_item in select * from jsonb_array_elements(coalesce(payload -> 'substanceIds', '[]'::jsonb)) loop
    if not exists (
      select 1 from public.user_substances us
       where us.id = (v_item #>> '{}')::uuid and us.user_id = v_user_id and us.is_active
    ) then
      raise exception 'invalid_substances' using errcode = '22023';
    end if;
    insert into public.craving_event_substances (craving_event_id, user_id, user_substance_id)
    values (v_event.id, v_user_id, (v_item #>> '{}')::uuid)
    on conflict do nothing;
    v_substance_count := v_substance_count + 1;
  end loop;
  if v_substance_count = 0 then
    raise exception 'invalid_substances' using errcode = '22023';
  end if;

  -- Émotions (facultatives)
  if jsonb_typeof(coalesce(payload -> 'emotions', '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(payload -> 'emotions', '[]'::jsonb)) > 20 then
    raise exception 'invalid_emotions' using errcode = '22023';
  end if;
  for v_item in select * from jsonb_array_elements(coalesce(payload -> 'emotions', '[]'::jsonb)) loop
    select e.id into v_catalogue_id from public.emotions e where e.slug = v_item #>> '{}' and e.is_active;
    if not found then
      raise exception 'invalid_emotions' using errcode = '22023';
    end if;
    insert into public.craving_event_emotions (craving_event_id, user_id, emotion_id)
    values (v_event.id, v_user_id, v_catalogue_id)
    on conflict do nothing;
  end loop;

  -- Déclencheurs (facultatifs ; aucun si « Je ne sais pas »)
  if jsonb_typeof(coalesce(payload -> 'triggers', '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(payload -> 'triggers', '[]'::jsonb)) > 20
     or (v_unknown and jsonb_array_length(coalesce(payload -> 'triggers', '[]'::jsonb)) > 0) then
    raise exception 'invalid_triggers' using errcode = '22023';
  end if;
  for v_item in select * from jsonb_array_elements(coalesce(payload -> 'triggers', '[]'::jsonb)) loop
    v_slug := v_item ->> 'slug';
    select t.id into v_catalogue_id from public.trigger_types t where t.slug = v_slug and t.is_active;
    if not found then
      raise exception 'invalid_triggers' using errcode = '22023';
    end if;
    insert into public.craving_event_triggers (craving_event_id, user_id, trigger_type_id, custom_label)
    values (v_event.id, v_user_id, v_catalogue_id,
            case when v_slug = 'other' then nullif(btrim(v_item ->> 'customLabel'), '') end)
    on conflict do nothing;
  end loop;

  return jsonb_build_object('id', v_event.id, 'localDate', v_event.local_date);
end;
$$;

/** Lit et verrouille un moment EN COURS de l'utilisateur courant. */
create or replace function public.lock_own_craving_event(p_event_id uuid)
returns public.craving_events
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event public.craving_events%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_event from public.craving_events e
   where e.id = p_event_id and e.user_id = auth.uid()
   for update;
  if not found then
    raise exception 'craving_event_not_found' using errcode = 'P0002';
  end if;
  return v_event;
end;
$$;

/**
 * Choisit la stratégie et démarre l'intervention (et son minuteur éventuel).
 * Idempotent : si l'intervention existe déjà, elle est renvoyée telle quelle.
 */
create or replace function public.start_craving_intervention(p_event_id uuid, payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event public.craving_events%rowtype;
  v_intervention public.craving_interventions%rowtype;
  v_strategy_id uuid;
  v_custom text;
  v_planned smallint;
begin
  v_event := public.lock_own_craving_event(p_event_id);
  if v_event.status <> 'in_progress' then
    raise exception 'craving_event_not_in_progress' using errcode = 'P0001';
  end if;

  select * into v_intervention from public.craving_interventions i where i.craving_event_id = v_event.id;
  if found then
    return jsonb_build_object('id', v_intervention.id, 'startedAt', v_intervention.started_at);
  end if;

  if jsonb_typeof(payload) is distinct from 'object' then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  v_custom := nullif(btrim(payload ->> 'customStrategyText'), '');
  if payload ->> 'strategySlug' is not null then
    select s.id into v_strategy_id from public.craving_strategies s
     where s.slug = payload ->> 'strategySlug' and s.is_active;
    if not found then
      raise exception 'invalid_strategy' using errcode = '22023';
    end if;
    v_custom := null;
  elsif v_custom is null then
    raise exception 'invalid_strategy' using errcode = '22023';
  end if;
  begin
    v_planned := (payload ->> 'plannedDurationMinutes')::smallint;
  exception when others then
    raise exception 'invalid_duration' using errcode = '22023';
  end;

  insert into public.craving_interventions (user_id, craving_event_id, strategy_id, custom_strategy_text, planned_duration_minutes)
  values (v_event.user_id, v_event.id, v_strategy_id, v_custom, v_planned)
  returning * into v_intervention;

  return jsonb_build_object('id', v_intervention.id, 'startedAt', v_intervention.started_at);
end;
$$;

/**
 * Minuteur : 'pause', 'resume' ou 'end' (fin de l'intervention → réévaluation).
 * Durée réelle = temps actif, bornée à la durée prévue si un minuteur existe.
 * Chaque action est idempotente.
 */
create or replace function public.update_craving_timer(p_event_id uuid, p_action text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event public.craving_events%rowtype;
  v_intervention public.craving_interventions%rowtype;
  v_active integer;
begin
  v_event := public.lock_own_craving_event(p_event_id);
  if v_event.status <> 'in_progress' then
    raise exception 'craving_event_not_in_progress' using errcode = 'P0001';
  end if;
  select * into v_intervention from public.craving_interventions i
   where i.craving_event_id = v_event.id for update;
  if not found then
    raise exception 'craving_intervention_not_found' using errcode = 'P0002';
  end if;

  if v_intervention.completed_at is null then
    if p_action = 'pause' and v_intervention.paused_at is null then
      update public.craving_interventions set paused_at = now() where id = v_intervention.id
      returning * into v_intervention;
    elsif p_action = 'resume' and v_intervention.paused_at is not null then
      update public.craving_interventions
         set paused_seconds = paused_seconds + greatest(0, floor(extract(epoch from now() - paused_at))::integer),
             paused_at = null
       where id = v_intervention.id
      returning * into v_intervention;
    elsif p_action = 'end' then
      v_active := greatest(0, floor(extract(epoch from coalesce(v_intervention.paused_at, now()) - v_intervention.started_at))::integer
                  - v_intervention.paused_seconds);
      if v_intervention.planned_duration_minutes is not null then
        v_active := least(v_active, v_intervention.planned_duration_minutes * 60);
      end if;
      update public.craving_interventions
         set completed_at = now(), paused_at = null, actual_duration_seconds = least(v_active, 86400)
       where id = v_intervention.id
      returning * into v_intervention;
    elsif p_action not in ('pause', 'resume', 'end') then
      raise exception 'invalid_timer_action' using errcode = '22023';
    end if;
  end if;

  return jsonb_build_object(
    'startedAt', v_intervention.started_at,
    'pausedAt', v_intervention.paused_at,
    'pausedSeconds', v_intervention.paused_seconds,
    'completedAt', v_intervention.completed_at
  );
end;
$$;

/**
 * Réévaluation et fin du moment. Le score final est OBLIGATOIRE : un moment n'est
 * jamais « completed » sans lui. Termine l'intervention si elle tournait encore.
 * Idempotent : un moment déjà terminé est renvoyé sans modification.
 */
create or replace function public.complete_craving_event(p_event_id uuid, payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event public.craving_events%rowtype;
  v_final smallint;
begin
  v_event := public.lock_own_craving_event(p_event_id);
  if v_event.status = 'completed' then
    return jsonb_build_object('id', v_event.id, 'status', v_event.status);
  end if;
  if v_event.status <> 'in_progress' then
    raise exception 'craving_event_not_in_progress' using errcode = 'P0001';
  end if;
  if jsonb_typeof(payload) is distinct from 'object' then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  begin
    v_final := (payload ->> 'finalCravingScore')::smallint;
  exception when others then
    raise exception 'invalid_values' using errcode = '22023';
  end;
  if v_final is null then
    raise exception 'missing_final_score' using errcode = '22023';
  end if;

  if exists (select 1 from public.craving_interventions i where i.craving_event_id = v_event.id and i.completed_at is null) then
    perform public.update_craving_timer(v_event.id, 'end');
  end if;
  update public.craving_interventions
     set helped_text = nullif(btrim(payload ->> 'helpedText'), '')
   where craving_event_id = v_event.id;

  update public.craving_events
     set final_craving_score = v_final,
         outcome_text = nullif(btrim(payload ->> 'outcomeText'), ''),
         status = 'completed',
         completed_at = now()
   where id = v_event.id
  returning * into v_event;

  return jsonb_build_object('id', v_event.id, 'status', v_event.status);
end;
$$;

/** « Ne pas continuer ce moment » : il reste enregistré, sans compter dans les analyses. */
create or replace function public.dismiss_craving_event(p_event_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event public.craving_events%rowtype;
begin
  v_event := public.lock_own_craving_event(p_event_id);
  if v_event.status <> 'in_progress' then
    return;
  end if;
  update public.craving_interventions
     set completed_at = coalesce(completed_at, coalesce(paused_at, now())), paused_at = null
   where craving_event_id = v_event.id;
  update public.craving_events set status = 'abandoned' where id = v_event.id;
end;
$$;

revoke execute on function public.current_user_local_date() from public, anon;
revoke execute on function public.close_stale_craving_events() from public, anon;
revoke execute on function public.start_craving_event(jsonb) from public, anon;
revoke execute on function public.lock_own_craving_event(uuid) from public, anon;
revoke execute on function public.start_craving_intervention(uuid, jsonb) from public, anon;
revoke execute on function public.update_craving_timer(uuid, text) from public, anon;
revoke execute on function public.complete_craving_event(uuid, jsonb) from public, anon;
revoke execute on function public.dismiss_craving_event(uuid) from public, anon;
grant execute on function public.current_user_local_date() to authenticated;
grant execute on function public.close_stale_craving_events() to authenticated;
grant execute on function public.start_craving_event(jsonb) to authenticated;
grant execute on function public.lock_own_craving_event(uuid) to authenticated;
grant execute on function public.start_craving_intervention(uuid, jsonb) to authenticated;
grant execute on function public.update_craving_timer(uuid, text) to authenticated;
grant execute on function public.complete_craving_event(uuid, jsonb) to authenticated;
grant execute on function public.dismiss_craving_event(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Privilèges (least privilege). Aucune suppression depuis l'application : la
-- suppression de compte passera par la cascade (Sprint 11). local_date,
-- started_at et user_id ne sont jamais modifiables.
-- -----------------------------------------------------------------------------
revoke all on table public.craving_strategies from anon, authenticated;
grant select on table public.craving_strategies to authenticated;

revoke all on table public.craving_events from anon, authenticated;
grant select, insert on table public.craving_events to authenticated;
grant update (final_craving_score, outcome_text, status, completed_at) on table public.craving_events to authenticated;

revoke all on table public.craving_event_substances, public.craving_event_emotions, public.craving_event_triggers
  from anon, authenticated;
grant select, insert on table public.craving_event_substances, public.craving_event_emotions, public.craving_event_triggers
  to authenticated;

revoke all on table public.craving_interventions from anon, authenticated;
grant select, insert on table public.craving_interventions to authenticated;
grant update (helped_text, actual_duration_seconds, paused_at, paused_seconds, completed_at)
  on table public.craving_interventions to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.craving_strategies enable row level security;
create policy "craving_strategies_select_active" on public.craving_strategies
  for select to authenticated using (is_active);

alter table public.craving_events enable row level security;
create policy "craving_events_select_own" on public.craving_events
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "craving_events_insert_own" on public.craving_events
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "craving_events_update_own" on public.craving_events
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.craving_event_substances enable row level security;
create policy "craving_event_substances_select_own" on public.craving_event_substances
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "craving_event_substances_insert_own" on public.craving_event_substances
  for insert to authenticated with check ((select auth.uid()) = user_id);

alter table public.craving_event_emotions enable row level security;
create policy "craving_event_emotions_select_own" on public.craving_event_emotions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "craving_event_emotions_insert_own" on public.craving_event_emotions
  for insert to authenticated with check ((select auth.uid()) = user_id);

alter table public.craving_event_triggers enable row level security;
create policy "craving_event_triggers_select_own" on public.craving_event_triggers
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "craving_event_triggers_insert_own" on public.craving_event_triggers
  for insert to authenticated with check ((select auth.uid()) = user_id);

alter table public.craving_interventions enable row level security;
create policy "craving_interventions_select_own" on public.craving_interventions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "craving_interventions_insert_own" on public.craving_interventions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "craving_interventions_update_own" on public.craving_interventions
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
