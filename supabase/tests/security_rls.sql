-- =============================================================================
-- Audit de sécurité (Sprint 11) : isolation User A / User B sur TOUTES les tables
-- personnelles (SELECT / UPDATE / DELETE / INSERT), références croisées vers des
-- parents d'un autre compte, affectation de champs non autorisés, invariants de dates,
-- fuseau, droits des fonctions, et suppression complète du compte.
--
-- Usage :
--   npx supabase db query --linked -f supabase/tests/security_rls.sql
--
-- Un seul bloc atomique qui se termine TOUJOURS par une exception : toutes les
-- écritures (utilisateurs fictifs compris) sont annulées.
--
-- Résultat attendu (affiché comme une erreur, c'est voulu) :
--   RLS_OK — security : 16 vérifications réussies (transaction annulée volontairement)
-- =============================================================================

do $$
declare
  user_a constant uuid := '00000000-0000-4000-8000-0000000000aa';
  user_b constant uuid := '00000000-0000-4000-8000-0000000000bb';
  v_today date := (now() at time zone 'America/Toronto')::date;
  v_sub_a uuid;
  v_sub_b uuid;
  v_checkin_a uuid;
  v_checkin_b uuid;
  v_event_a uuid := gen_random_uuid();
  v_event_b uuid := gen_random_uuid();
  v_count integer;
  v_total integer;
  v_error text;
  v_table text;
  v_owner text;
  v_col text;
  -- Toutes les tables personnelles et leur colonne de propriétaire.
  v_owned text[][] := array[
    ['profiles', 'id'], ['user_substances', 'user_id'], ['personal_reasons', 'user_id'],
    ['user_motivations', 'user_id'], ['support_contacts', 'user_id'], ['onboarding_drafts', 'user_id'],
    ['daily_checkins', 'user_id'], ['checkin_emotions', 'user_id'], ['checkin_triggers', 'user_id'],
    ['checkin_achievements', 'user_id'], ['consumption_events', 'user_id'], ['craving_events', 'user_id'],
    ['craving_event_substances', 'user_id'], ['craving_event_emotions', 'user_id'],
    ['craving_event_triggers', 'user_id'], ['craving_interventions', 'user_id'],
    ['user_personal_triggers', 'user_id'], ['user_personal_strategies', 'user_id'], ['safe_places', 'user_id'],
    ['personal_reminders', 'user_id'], ['self_letters', 'user_id'], ['user_achievements', 'user_id'],
    ['ai_preferences', 'user_id'], ['ai_reflections', 'user_id']
  ];
  -- Une colonne modifiable (droit UPDATE accordé) par table, pour le test de modification.
  v_updatable text[][] := array[
    ['profiles', 'display_name', 'id'], ['user_substances', 'goal', 'user_id'],
    ['personal_reasons', 'reason_text', 'user_id'], ['user_motivations', 'custom_label', 'user_id'],
    ['support_contacts', 'name', 'user_id'], ['onboarding_drafts', 'current_step', 'user_id'],
    ['daily_checkins', 'notes', 'user_id'], ['consumption_events', 'unit', 'user_id'],
    ['craving_events', 'outcome_text', 'user_id'], ['craving_interventions', 'helped_text', 'user_id'],
    ['user_personal_triggers', 'notes', 'user_id'], ['user_personal_strategies', 'notes', 'user_id'],
    ['safe_places', 'name', 'user_id'], ['personal_reminders', 'content', 'user_id'],
    ['self_letters', 'content', 'user_id'], ['ai_preferences', 'include_reflections', 'user_id']
  ];
begin
  insert into auth.users (id, aud, role, email, raw_user_meta_data) values
    (user_a, 'authenticated', 'authenticated', 'sec-test-a@example.invalid', '{"display_name":"Alpha","timezone":"America/Toronto"}'),
    (user_b, 'authenticated', 'authenticated', 'sec-test-b@example.invalid', '{"display_name":"Bravo","timezone":"America/Toronto"}');
  insert into public.user_substances (user_id, substance_id, goal, started_on, is_primary)
  select user_a, s.id, 'abstinence', v_today - 10, true from public.substances s where s.slug = 'cannabis' returning id into v_sub_a;
  insert into public.user_substances (user_id, substance_id, goal, started_on, is_primary)
  select user_b, s.id, 'abstinence', v_today - 10, true from public.substances s where s.slug = 'cannabis' returning id into v_sub_b;

  perform set_config('role', 'authenticated', true);

  -- Données complètes pour A et B (une ligne dans chaque table personnelle).
  foreach v_owner in array array[user_a::text, user_b::text] loop
    perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
    perform public.save_checkin(jsonb_build_object(
      'checkinDate', v_today, 'status', 'consumed', 'moodScore', 5, 'energyScore', 5, 'stressScore', 6, 'cravingScore', 7,
      'emotions', jsonb_build_array('stress'), 'triggers', jsonb_build_array(jsonb_build_object('slug', 'work')),
      'achievements', jsonb_build_array(jsonb_build_object('slug', 'exercise')), 'notes', 'Note fictive.',
      'consumptionEvents', jsonb_build_array(jsonb_build_object('userSubstanceId', case when v_owner = user_a::text then v_sub_a else v_sub_b end))
    ), true);
    perform public.start_craving_event(jsonb_build_object('id', case when v_owner = user_a::text then v_event_a else v_event_b end,
      'initialCravingScore', 8, 'substanceIds', jsonb_build_array(case when v_owner = user_a::text then v_sub_a else v_sub_b end),
      'emotions', jsonb_build_array('stress'), 'triggers', jsonb_build_array(jsonb_build_object('slug', 'stress'))));
    perform public.start_craving_intervention(case when v_owner = user_a::text then v_event_a else v_event_b end, jsonb_build_object('strategySlug', 'walk'));
    perform public.complete_craving_event(case when v_owner = user_a::text then v_event_a else v_event_b end, jsonb_build_object('finalCravingScore', 5, 'outcomeText', 'Issue fictive.'));
    insert into public.personal_reasons (user_id, reason_text) values (v_owner::uuid, 'Raison fictive.');
    insert into public.user_motivations (user_id, motivation) values (v_owner::uuid, 'health');
    insert into public.support_contacts (user_id, name) values (v_owner::uuid, 'Contact fictif');
    insert into public.onboarding_drafts (user_id, current_step, data) values (v_owner::uuid, 1, '{}'::jsonb);
    insert into public.user_personal_triggers (user_id, custom_label) values (v_owner::uuid, 'Déclencheur fictif');
    insert into public.user_personal_strategies (user_id, custom_name) values (v_owner::uuid, 'Stratégie fictive');
    insert into public.safe_places (user_id, name) values (v_owner::uuid, 'Lieu fictif');
    insert into public.personal_reminders (user_id, content) values (v_owner::uuid, 'Rappel fictif.');
    insert into public.self_letters (user_id, content) values (v_owner::uuid, 'Lettre fictive.');
    perform public.award_achievements();
    insert into public.ai_preferences (user_id, ai_enabled, consented_at, consent_version) values (v_owner::uuid, true, now(), '1');
    perform public.save_ai_reflection(v_today - 6, v_today, 'Bilan fictif de la semaine.', '{"summary":"Bilan fictif de la semaine."}'::jsonb,
      'test', 'modele-fictif', 'weekly-reflection-v1');
  end loop;
  select id into v_checkin_b from public.daily_checkins where user_id = user_b;

  -- Contexte : A -----------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);
  select id into v_checkin_a from public.daily_checkins where user_id = user_a;

  -- 1. A possède une ligne dans CHAQUE table personnelle (jeu de test complet)
  for i in 1..array_length(v_owned, 1) loop
    execute format('select count(*) from public.%I where %I = $1', v_owned[i][1], v_owned[i][2]) into v_count using user_a;
    if v_count = 0 then raise exception 'ÉCHEC 1 : aucune ligne de A dans %', v_owned[i][1]; end if;
  end loop;

  -- 2. SELECT : A ne lit aucune ligne de B (24 tables)
  for i in 1..array_length(v_owned, 1) loop
    execute format('select count(*) from public.%I where %I = $1', v_owned[i][1], v_owned[i][2]) into v_count using user_b;
    if v_count <> 0 then raise exception 'ÉCHEC 2 : A lit % ligne(s) de B dans %', v_count, v_owned[i][1]; end if;
  end loop;

  -- 3. UPDATE : aucune ligne de B modifiée (16 tables modifiables)
  for i in 1..array_length(v_updatable, 1) loop
    execute format('update public.%I set %I = %I where %I = $1', v_updatable[i][1], v_updatable[i][2], v_updatable[i][2], v_updatable[i][3]) using user_b;
    get diagnostics v_count = row_count;
    if v_count <> 0 then raise exception 'ÉCHEC 3 : A modifie B dans %', v_updatable[i][1]; end if;
  end loop;

  -- 4. DELETE : aucune ligne de B supprimée (refus ou 0 ligne selon les droits)
  for i in 1..array_length(v_owned, 1) loop
    begin
      execute format('delete from public.%I where %I = $1', v_owned[i][1], v_owned[i][2]) using user_b;
      get diagnostics v_count = row_count;
      if v_count <> 0 then raise exception 'ÉCHEC 4 : A supprime B dans %', v_owned[i][1]; end if;
    exception when insufficient_privilege then null;
    end;
  end loop;

  -- 5. INSERT au nom de B : refusé partout (RLS WITH CHECK ou absence de droit)
  foreach v_table in array array['personal_reasons', 'self_letters', 'safe_places', 'support_contacts', 'personal_reminders', 'user_personal_strategies'] loop
    begin
      execute format('insert into public.%I (user_id, %I) values ($1, %L)', v_table,
        case v_table when 'personal_reasons' then 'reason_text' when 'self_letters' then 'content' when 'personal_reminders' then 'content'
                     when 'user_personal_strategies' then 'custom_name' else 'name' end, 'Intrus') using user_b;
      raise exception 'ÉCHEC 5 : insertion au nom de B dans %', v_table;
    exception when insufficient_privilege then null;
    end;
  end loop;
  begin
    insert into public.user_achievements (user_id, achievement_definition_id, earned_at)
    select user_a, d.id, now() from public.achievement_definitions d where d.slug = 'sober-days-365';
    raise exception 'ÉCHEC 5 : auto-attribution';
  exception when insufficient_privilege then null;
  end;

  -- 6. Références croisées : relation de A sur un parent de B (clés composites)
  begin
    insert into public.checkin_emotions (checkin_id, user_id, emotion_id) select v_checkin_b, user_a, e.id from public.emotions e where e.slug = 'calm';
    raise exception 'ÉCHEC 6 : émotion sur le check-in de B';
  exception when foreign_key_violation then null;
  end;
  -- Clés vers user_substances DIFFÉRÉES (vérifiées au COMMIT de chaque requête) : on force
  -- ici la vérification immédiate pour observer le refus dans ce bloc de test.
  set constraints all immediate;
  begin
    insert into public.consumption_events (checkin_id, user_id, user_substance_id) values (v_checkin_a, user_a, v_sub_b);
    raise exception 'ÉCHEC 6 : consommation de A avec la substance de B';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into public.craving_event_substances (craving_event_id, user_id, user_substance_id) values (v_event_a, user_a, v_sub_b);
    raise exception 'ÉCHEC 6 : moment de A avec la substance de B';
  exception when foreign_key_violation then null;
  end;
  set constraints all deferred;
  begin
    insert into public.craving_interventions (user_id, craving_event_id, custom_strategy_text) values (user_a, v_event_b, 'Intrus');
    raise exception 'ÉCHEC 6 : intervention de A sur le moment de B';
  -- Refus par la clé composite ou par l'index « une intervention par moment » (voir SECURITY.md).
  exception when foreign_key_violation or unique_violation then null;
  end;

  -- 7. RPC avec des identifiants de B (UUID devinés) : refusées
  v_error := null;
  begin
    perform public.save_checkin(jsonb_build_object('checkinDate', v_today - 1, 'status', 'consumed', 'moodScore', 5, 'energyScore', 5,
      'stressScore', 5, 'cravingScore', 5, 'consumptionEvents', jsonb_build_array(jsonb_build_object('userSubstanceId', v_sub_b))), true);
  exception when others then v_error := sqlerrm;
  end;
  if v_error is distinct from 'invalid_consumption_events' then raise exception 'ÉCHEC 7 : check-in A + substance B (%)', v_error; end if;
  foreach v_col in array array['intervention', 'timer', 'complete', 'dismiss'] loop
    begin
      case v_col
        when 'intervention' then perform public.start_craving_intervention(v_event_b, jsonb_build_object('strategySlug', 'walk'));
        when 'timer' then perform public.update_craving_timer(v_event_b, 'end');
        when 'complete' then perform public.complete_craving_event(v_event_b, jsonb_build_object('finalCravingScore', 1));
        else perform public.dismiss_craving_event(v_event_b);
      end case;
      raise exception 'ÉCHEC 7 : RPC % sur le moment de B', v_col;
    exception when no_data_found then null;
    end;
  end loop;

  -- 8. Affectation de champs non autorisés (mass assignment) : user_id, created_at, completed_at d'un moment…
  foreach v_col in array array['user_id', 'created_at', 'updated_at'] loop
    begin
      execute format('update public.self_letters set %I = %I where user_id = $1', v_col, v_col) using user_a;
      raise exception 'ÉCHEC 8 : colonne % modifiable', v_col;
    exception when insufficient_privilege then null;
    end;
  end loop;
  begin
    update public.profiles set onboarding_completed = false where id = user_a;
    raise exception 'ÉCHEC 8 : onboarding_completed modifiable';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.user_substances set substance_id = substance_id where user_id = user_a;
    raise exception 'ÉCHEC 8 : substance_id modifiable';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.craving_events set local_date = local_date where user_id = user_a;
    raise exception 'ÉCHEC 8 : local_date modifiable';
  exception when insufficient_privilege then null;
  end;

  -- 9. Dates métier futures refusées, même par écriture directe
  begin
    insert into public.daily_checkins (user_id, checkin_date, status) values (user_a, v_today + 3, 'sober');
    raise exception 'ÉCHEC 9 : check-in futur accepté';
  exception when check_violation then null;
  end;
  begin
    insert into public.craving_events (user_id, local_date, initial_craving_score) values (user_a, v_today + 3, 5);
    raise exception 'ÉCHEC 9 : moment futur accepté';
  exception when check_violation then null;
  end;
  begin
    update public.user_substances set started_on = v_today + 3 where id = v_sub_a;
    raise exception 'ÉCHEC 9 : début de suivi futur accepté';
  exception when check_violation then null;
  end;

  -- 10. 7e substance active refusée, même par écriture directe (catalogue de 6 : on remplit tout)
  insert into public.user_substances (user_id, substance_id, goal, started_on)
  select user_a, s.id, 'observation', v_today from public.substances s
   where s.slug not in ('cannabis', 'other') and s.is_active;
  insert into public.user_substances (user_id, substance_id, custom_name, goal, started_on)
  select user_a, s.id, 'Autre fictive', 'observation', v_today from public.substances s where s.slug = 'other';
  select count(*) into v_count from public.user_substances where user_id = user_a and is_active;
  if v_count <> 6 then raise exception 'ÉCHEC 10 : % substances actives', v_count; end if;
  v_error := null;
  begin
    insert into public.user_substances (user_id, substance_id, goal, started_on)
    select user_a, s.id, 'observation', v_today from public.substances s where s.slug = 'alcohol';
  exception when others then v_error := sqlerrm;
  end;
  if v_error is distinct from 'too_many_substances' then raise exception 'ÉCHEC 10 : %', v_error; end if;

  -- 11. Fuseau inconnu refusé, fuseau IANA accepté (dates historiques inchangées)
  begin
    update public.profiles set timezone = 'Mars/Olympus_Mons' where id = user_a;
    raise exception 'ÉCHEC 11 : fuseau inconnu accepté';
  exception when check_violation then null;
  end;
  update public.profiles set timezone = 'Europe/Paris' where id = user_a;
  select count(*) into v_count from public.daily_checkins where user_id = user_a and checkin_date = v_today;
  if v_count <> 1 then raise exception 'ÉCHEC 11 : date historique modifiée par le changement de fuseau'; end if;

  -- 12. Fonctions internes / de trigger non exécutables par l'application
  foreach v_col in array array['public.achievement_metric_events(uuid)', 'public.award_achievements_for(uuid)', 'public.set_updated_at()',
                               'public.handle_new_user()', 'public.enforce_max_favorites()', 'public.ensure_onboarding_requirements()'] loop
    if has_function_privilege('authenticated', v_col, 'EXECUTE') then raise exception 'ÉCHEC 12 : % exécutable', v_col; end if;
  end loop;
  if has_function_privilege('anon', 'public.delete_my_account()', 'EXECUTE') or has_function_privilege('anon', 'public.award_achievements()', 'EXECUTE') then
    raise exception 'ÉCHEC 12 : fonction sensible exécutable par anon';
  end if;

  -- 13. Suppression du compte : non authentifié refusé
  perform set_config('request.jwt.claims', '', true);
  v_error := null;
  begin
    perform public.delete_my_account();
  exception when others then v_error := sqlerrm;
  end;
  if v_error is distinct from 'not_authenticated' then raise exception 'ÉCHEC 13 : %', v_error; end if;

  -- 14. A supprime SON compte (aucun paramètre : impossible de viser B)
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);
  perform public.delete_my_account();

  -- Vérification avec les droits d'administration (hors RLS)
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);

  -- 15. Plus aucune ligne de A dans aucune table personnelle, ni dans auth.users
  v_total := 0;
  for i in 1..array_length(v_owned, 1) loop
    execute format('select count(*) from public.%I where %I = $1', v_owned[i][1], v_owned[i][2]) into v_count using user_a;
    if v_count <> 0 then raise exception 'ÉCHEC 15 : % ligne(s) restante(s) de A dans %', v_count, v_owned[i][1]; end if;
  end loop;
  select count(*) into v_count from auth.users where id = user_a;
  if v_count <> 0 then raise exception 'ÉCHEC 15 : compte Auth de A restant'; end if;

  -- 16. B est intact (une ligne dans chaque table personnelle)
  for i in 1..array_length(v_owned, 1) loop
    execute format('select count(*) from public.%I where %I = $1', v_owned[i][1], v_owned[i][2]) into v_count using user_b;
    if v_count = 0 then raise exception 'ÉCHEC 16 : données de B supprimées dans %', v_owned[i][1]; end if;
  end loop;

  raise exception 'RLS_OK — security : 16 vérifications réussies (transaction annulée volontairement)';
end;
$$;
