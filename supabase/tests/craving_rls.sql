-- =============================================================================
-- Vérification du mode « J'ai envie de consommer » : RLS, contraintes, RPC,
-- idempotence, plusieurs moments par jour, minuteur, fin, moments expirés.
--
-- Usage :
--   npx supabase db query --linked -f supabase/tests/craving_rls.sql
--
-- Un seul bloc atomique qui se termine TOUJOURS par une exception : toutes les
-- écritures (utilisateurs fictifs compris) sont annulées.
--
-- Résultat attendu (affiché comme une erreur, c'est voulu) :
--   RLS_OK — craving : 24 vérifications réussies (transaction annulée volontairement)
-- =============================================================================

do $$
declare
  user_a constant uuid := '00000000-0000-4000-8000-0000000000a7';
  user_b constant uuid := '00000000-0000-4000-8000-0000000000b7';
  event_a1 constant uuid := '00000000-0000-4000-8000-0000000001a7';
  event_a2 constant uuid := '00000000-0000-4000-8000-0000000002a7';
  event_a3 constant uuid := '00000000-0000-4000-8000-0000000003a7';
  event_stale constant uuid := '00000000-0000-4000-8000-0000000004a7';
  v_today date := (now() at time zone 'America/Toronto')::date;
  v_cannabis_a uuid;
  v_nicotine_a uuid;
  v_cannabis_b uuid;
  v_count integer;
  v_error text;
  v_result jsonb;
  v_event public.craving_events%rowtype;
  v_intervention public.craving_interventions%rowtype;
begin
  insert into auth.users (id, aud, role, email, raw_user_meta_data) values
    (user_a, 'authenticated', 'authenticated', 'crv-test-a@example.invalid', '{"display_name":"A","timezone":"America/Toronto"}'),
    (user_b, 'authenticated', 'authenticated', 'crv-test-b@example.invalid', '{"display_name":"B","timezone":"America/Toronto"}');

  insert into public.user_substances (user_id, substance_id, goal, started_on, is_primary)
  select user_a, s.id, 'abstinence', v_today - 10, s.slug = 'cannabis'
    from public.substances s where s.slug in ('cannabis', 'nicotine');
  select us.id into v_cannabis_a from public.user_substances us
    join public.substances s on s.id = us.substance_id where us.user_id = user_a and s.slug = 'cannabis';
  select us.id into v_nicotine_a from public.user_substances us
    join public.substances s on s.id = us.substance_id where us.user_id = user_a and s.slug = 'nicotine';
  insert into public.user_substances (user_id, substance_id, goal, started_on, is_primary)
  select user_b, s.id, 'reduction', v_today - 5, true from public.substances s where s.slug = 'cannabis'
  returning id into v_cannabis_b;

  -- Contexte : utilisateur A ---------------------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);

  -- 1. Catalogue des stratégies lisible (9 stratégies)
  select count(*) into v_count from public.craving_strategies;
  if v_count <> 9 then raise exception 'ÉCHEC 1 : % stratégies', v_count; end if;

  -- 2. Catalogue non modifiable
  begin
    insert into public.craving_strategies (slug, name_fr, description_fr, sort_order) values ('pirate', 'Pirate', 'X', 99);
    raise exception 'ÉCHEC 2 : catalogue modifiable';
  exception when insufficient_privilege then null;
  end;

  -- 3. Envie initiale -1 et 11 refusées
  foreach v_count in array array[-1, 11] loop
    v_error := null;
    begin
      perform public.start_craving_event(jsonb_build_object('id', gen_random_uuid(), 'initialCravingScore', v_count,
        'substanceIds', jsonb_build_array(v_cannabis_a)));
    exception when check_violation then v_error := 'ok';
    end;
    if v_error is null then raise exception 'ÉCHEC 3 : envie initiale % acceptée', v_count; end if;
  end loop;

  -- 4. Moment valide : envie 8, cannabis + nicotine, émotions, déclencheurs, contexte
  v_result := public.start_craving_event(jsonb_build_object(
    'id', event_a1, 'initialCravingScore', 8,
    'substanceIds', jsonb_build_array(v_cannabis_a, v_nicotine_a),
    'emotions', jsonb_build_array('stress', 'fatigue'),
    'triggers', jsonb_build_array(jsonb_build_object('slug', 'stress'), jsonb_build_object('slug', 'other', 'customLabel', 'Précision')),
    'contextText', 'Contexte fictif.'));
  select * into v_event from public.craving_events where id = event_a1;
  if v_event.status <> 'in_progress' or v_event.local_date <> v_today or v_event.initial_craving_score <> 8 then
    raise exception 'ÉCHEC 4 : moment mal créé';
  end if;
  select count(*) into v_count from public.craving_event_substances where craving_event_id = event_a1;
  if v_count <> 2 then raise exception 'ÉCHEC 4 : % substances', v_count; end if;
  select count(*) into v_count from public.craving_event_triggers where craving_event_id = event_a1 and custom_label = 'Précision';
  if v_count <> 1 then raise exception 'ÉCHEC 4 : précision « Autre » absente'; end if;

  -- 5. Double envoi (même identifiant) : un seul moment
  perform public.start_craving_event(jsonb_build_object('id', event_a1, 'initialCravingScore', 8,
    'substanceIds', jsonb_build_array(v_cannabis_a)));
  select count(*) into v_count from public.craving_events where id = event_a1;
  if v_count <> 1 then raise exception 'ÉCHEC 5 : doublon créé'; end if;

  -- 6. Envie 0 acceptée ; deuxième moment le même jour autorisé et indépendant
  perform public.start_craving_event(jsonb_build_object('id', event_a2, 'initialCravingScore', 0,
    'substanceIds', jsonb_build_array(v_cannabis_a), 'triggerUnknown', true));
  select count(*) into v_count from public.craving_events where local_date = v_today;
  if v_count <> 2 then raise exception 'ÉCHEC 6 : % moments aujourd''hui', v_count; end if;

  -- 7. Substance d'un autre utilisateur refusée
  v_error := null;
  begin
    perform public.start_craving_event(jsonb_build_object('id', gen_random_uuid(), 'initialCravingScore', 5,
      'substanceIds', jsonb_build_array(v_cannabis_b)));
  exception when others then v_error := sqlerrm;
  end;
  if v_error is distinct from 'invalid_substances' then raise exception 'ÉCHEC 7 : %', v_error; end if;

  -- 8. Aucune substance refusée
  v_error := null;
  begin
    perform public.start_craving_event(jsonb_build_object('id', gen_random_uuid(), 'initialCravingScore', 5));
  exception when others then v_error := sqlerrm;
  end;
  if v_error is distinct from 'invalid_substances' then raise exception 'ÉCHEC 8 : %', v_error; end if;

  -- 9. « Je ne sais pas » + déclencheurs : incohérent, refusé
  v_error := null;
  begin
    perform public.start_craving_event(jsonb_build_object('id', gen_random_uuid(), 'initialCravingScore', 5,
      'substanceIds', jsonb_build_array(v_cannabis_a), 'triggerUnknown', true,
      'triggers', jsonb_build_array(jsonb_build_object('slug', 'stress'))));
  exception when others then v_error := sqlerrm;
  end;
  if v_error is distinct from 'invalid_triggers' then raise exception 'ÉCHEC 9 : %', v_error; end if;

  -- 10. Stratégie personnelle sans texte refusée
  v_error := null;
  begin
    perform public.start_craving_intervention(event_a1, jsonb_build_object('customStrategyText', '  '));
  exception when others then v_error := sqlerrm;
  end;
  if v_error is distinct from 'invalid_strategy' then raise exception 'ÉCHEC 10 : %', v_error; end if;

  -- 11. Durée hors bornes (121 min) refusée
  v_error := null;
  begin
    perform public.start_craving_intervention(event_a1, jsonb_build_object('strategySlug', 'walk', 'plannedDurationMinutes', 121));
  exception when check_violation then v_error := 'ok';
  end;
  if v_error is null then raise exception 'ÉCHEC 11 : durée 121 acceptée'; end if;

  -- 12. Intervention « Marcher », 10 minutes ; idempotente
  perform public.start_craving_intervention(event_a1, jsonb_build_object('strategySlug', 'walk', 'plannedDurationMinutes', 10));
  perform public.start_craving_intervention(event_a1, jsonb_build_object('strategySlug', 'music', 'plannedDurationMinutes', 5));
  select count(*) into v_count from public.craving_interventions where craving_event_id = event_a1;
  if v_count <> 1 then raise exception 'ÉCHEC 12 : % interventions', v_count; end if;
  select i.* into v_intervention from public.craving_interventions i where i.craving_event_id = event_a1;
  if v_intervention.planned_duration_minutes <> 10 then raise exception 'ÉCHEC 12 : intervention remplacée'; end if;

  -- 13. Minuteur : pause puis reprise
  perform public.update_craving_timer(event_a1, 'pause');
  select paused_at into v_intervention.paused_at from public.craving_interventions where craving_event_id = event_a1;
  if v_intervention.paused_at is null then raise exception 'ÉCHEC 13 : pause non enregistrée'; end if;
  perform public.update_craving_timer(event_a1, 'resume');
  select * into v_intervention from public.craving_interventions where craving_event_id = event_a1;
  if v_intervention.paused_at is not null or v_intervention.paused_seconds < 0 then raise exception 'ÉCHEC 13 : reprise'; end if;

  -- 14. Fin sans score final refusée (jamais « completed » sans score)
  v_error := null;
  begin
    perform public.complete_craving_event(event_a1, '{}'::jsonb);
  exception when others then v_error := sqlerrm;
  end;
  if v_error is distinct from 'missing_final_score' then raise exception 'ÉCHEC 14 : %', v_error; end if;

  -- 15. Score final 11 refusé
  v_error := null;
  begin
    perform public.complete_craving_event(event_a1, jsonb_build_object('finalCravingScore', 11));
  exception when check_violation then v_error := 'ok';
  end;
  if v_error is null then raise exception 'ÉCHEC 15 : score final 11 accepté'; end if;

  -- 16. Fin : score 5, intervention terminée (durée réelle), moment « completed »
  perform public.complete_craving_event(event_a1, jsonb_build_object('finalCravingScore', 5, 'helpedText', 'Aide fictive.', 'outcomeText', 'Note fictive.'));
  select * into v_event from public.craving_events where id = event_a1;
  select * into v_intervention from public.craving_interventions where craving_event_id = event_a1;
  if v_event.status <> 'completed' or v_event.final_craving_score <> 5 or v_event.completed_at is null
     or v_intervention.completed_at is null or v_intervention.actual_duration_seconds is null
     or v_intervention.helped_text <> 'Aide fictive.' then
    raise exception 'ÉCHEC 16 : fin incomplète';
  end if;

  -- 17. La journée locale reste celle du début ; elle n'est pas modifiable
  if v_event.local_date <> v_today then raise exception 'ÉCHEC 17 : journée modifiée'; end if;
  begin
    update public.craving_events set local_date = v_today - 1 where id = event_a1;
    raise exception 'ÉCHEC 17 : local_date modifiable';
  exception when insufficient_privilege then null;
  end;

  -- 18. Moment terminé : plus de minuteur ni de nouvelle intervention
  v_error := null;
  begin
    perform public.update_craving_timer(event_a1, 'pause');
  exception when others then v_error := sqlerrm;
  end;
  if v_error is distinct from 'craving_event_not_in_progress' then raise exception 'ÉCHEC 18 : %', v_error; end if;

  -- 19. Aucune suppression depuis l'application
  begin
    delete from public.craving_events where id = event_a1;
    raise exception 'ÉCHEC 19 : suppression autorisée';
  exception when insufficient_privilege then null;
  end;

  -- 20. « Ne pas continuer » : moment mis de côté (abandoned), sans fin
  perform public.dismiss_craving_event(event_a2);
  select * into v_event from public.craving_events where id = event_a2;
  if v_event.status <> 'abandoned' or v_event.completed_at is not null then raise exception 'ÉCHEC 20 : %', v_event.status; end if;

  -- 21. Moment en cours d'une journée passée → « abandoned » (transition documentée)
  insert into public.craving_events (id, user_id, local_date, initial_craving_score, started_at)
  values (event_stale, user_a, v_today - 2, 6, now() - interval '2 days');
  perform public.close_stale_craving_events();
  select * into v_event from public.craving_events where id = event_stale;
  if v_event.status <> 'abandoned' then raise exception 'ÉCHEC 21 : moment ancien toujours en cours'; end if;

  -- Un moment en cours pour les tests d'isolation
  perform public.start_craving_event(jsonb_build_object('id', event_a3, 'initialCravingScore', 7,
    'substanceIds', jsonb_build_array(v_cannabis_a)));

  -- Contexte : utilisateur B ---------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', user_b, 'role', 'authenticated')::text, true);

  -- 22. B ne voit aucun moment, relation ni intervention de A
  select count(*) into v_count from public.craving_events;
  if v_count <> 0 then raise exception 'ÉCHEC 22 : B voit % moments', v_count; end if;
  select count(*) into v_count from public.craving_interventions;
  if v_count <> 0 then raise exception 'ÉCHEC 22 : B voit des interventions'; end if;
  select count(*) into v_count from public.craving_event_triggers;
  if v_count <> 0 then raise exception 'ÉCHEC 22 : B voit des déclencheurs'; end if;

  -- 23. B ne peut ni démarrer, ni minuter, ni terminer le moment de A (UUID deviné)
  foreach v_error in array array['intervention', 'timer', 'complete', 'dismiss'] loop
    begin
      case v_error
        when 'intervention' then perform public.start_craving_intervention(event_a3, jsonb_build_object('strategySlug', 'walk'));
        when 'timer' then perform public.update_craving_timer(event_a3, 'end');
        when 'complete' then perform public.complete_craving_event(event_a3, jsonb_build_object('finalCravingScore', 0));
        else perform public.dismiss_craving_event(event_a3);
      end case;
      raise exception 'ÉCHEC 23 : B a pu agir (%)', v_error;
    exception when no_data_found then null;
    end;
  end loop;
  update public.craving_events set status = 'completed', final_craving_score = 0, completed_at = now() where id = event_a3;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'ÉCHEC 23 : B a modifié le moment de A'; end if;

  -- 24. B ne peut pas rattacher une ligne au moment de A
  begin
    insert into public.craving_event_substances (craving_event_id, user_id, user_substance_id) values (event_a3, user_b, v_cannabis_b);
    raise exception 'ÉCHEC 24 : rattachement accepté';
  exception when foreign_key_violation then null;
  end;

  raise exception 'RLS_OK — craving : 24 vérifications réussies (transaction annulée volontairement)';
end;
$$;
