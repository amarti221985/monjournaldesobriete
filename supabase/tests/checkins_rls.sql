-- =============================================================================
-- Vérification du check-in quotidien : RLS, unicité par journée, cohérence
-- statut / consommations, finalisation, modification, brouillons, catalogues.
--
-- Usage :
--   npx supabase db query --linked -f supabase/tests/checkins_rls.sql
--
-- Un seul bloc atomique qui se termine TOUJOURS par une exception : toutes les
-- écritures (utilisateurs fictifs compris) sont annulées.
--
-- Résultat attendu (affiché comme une erreur, c'est voulu) :
--   RLS_OK — checkins : 26 vérifications réussies (transaction annulée volontairement)
-- =============================================================================

do $$
declare
  user_a constant uuid := '00000000-0000-4000-8000-0000000000a2';
  user_b constant uuid := '00000000-0000-4000-8000-0000000000b2';
  v_today date := (now() at time zone 'America/Toronto')::date;
  v_cannabis_a uuid;
  v_alcohol_a uuid;
  v_cannabis_b uuid;
  v_checkin_a uuid;
  v_count integer;
  v_error text;
  v_result jsonb;
  v_base jsonb;
begin
  insert into auth.users (id, aud, role, email, raw_user_meta_data) values
    (user_a, 'authenticated', 'authenticated', 'chk-test-a@example.invalid', '{"display_name":"A","timezone":"America/Toronto"}'),
    (user_b, 'authenticated', 'authenticated', 'chk-test-b@example.invalid', '{"display_name":"B","timezone":"America/Toronto"}');

  -- Substances suivies (préparées directement, en administrateur)
  insert into public.user_substances (user_id, substance_id, goal, started_on, is_primary)
  select user_a, s.id, 'abstinence', v_today - 10, s.slug = 'cannabis'
    from public.substances s where s.slug in ('cannabis', 'alcohol');
  select us.id into v_cannabis_a from public.user_substances us
    join public.substances s on s.id = us.substance_id where us.user_id = user_a and s.slug = 'cannabis';
  select us.id into v_alcohol_a from public.user_substances us
    join public.substances s on s.id = us.substance_id where us.user_id = user_a and s.slug = 'alcohol';
  insert into public.user_substances (user_id, substance_id, goal, started_on, is_primary)
  select user_b, s.id, 'reduction', v_today - 5, true from public.substances s where s.slug = 'cannabis'
  returning id into v_cannabis_b;

  v_base := jsonb_build_object(
    'checkinDate', v_today, 'status', 'sober',
    'moodScore', 7, 'energyScore', 6, 'stressScore', 4, 'cravingScore', 3,
    'emotions', jsonb_build_array('calm', 'pride'),
    'triggers', jsonb_build_array(jsonb_build_object('slug', 'other', 'customLabel', 'Précision')),
    'achievements', jsonb_build_array(jsonb_build_object('slug', 'exercise')),
    'victoryText', 'Une victoire.'
  );

  -- Contexte : utilisateur A ---------------------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);

  -- 1. Catalogues lisibles
  select count(*) into v_count from public.emotions;
  if v_count <> 15 then raise exception 'ÉCHEC 1 : % émotions', v_count; end if;
  select count(*) into v_count from public.trigger_types;
  if v_count <> 13 then raise exception 'ÉCHEC 1 : % déclencheurs', v_count; end if;
  select count(*) into v_count from public.achievement_types;
  if v_count <> 11 then raise exception 'ÉCHEC 1 : % accomplissements', v_count; end if;

  -- 2. Catalogues non modifiables
  begin
    insert into public.emotions (slug, name_fr, category, sort_order) values ('pirate', 'Pirate', 'positive', 99);
    raise exception 'ÉCHEC 2 : catalogue modifiable';
  exception when insufficient_privilege then null;
  end;

  -- 3. Brouillon (statut choisi, scores partiels)
  v_result := public.save_checkin(jsonb_build_object('checkinDate', v_today, 'status', 'sober', 'moodScore', 5), false);
  if (v_result ->> 'completed')::boolean then raise exception 'ÉCHEC 3 : brouillon marqué terminé'; end if;
  v_checkin_a := (v_result ->> 'id')::uuid;

  -- 4. Finalisation refusée sans les 4 scores
  v_error := null;
  begin
    perform public.save_checkin(jsonb_build_object('checkinDate', v_today, 'status', 'sober', 'moodScore', 5), true);
  exception when others then v_error := sqlerrm;
  end;
  if v_error is distinct from 'missing_scores' then raise exception 'ÉCHEC 4 : %', v_error; end if;

  -- 5. Finalisation « sober » valide (émotions, déclencheur « other », accomplissement)
  v_result := public.save_checkin(v_base, true);
  if not (v_result ->> 'completed')::boolean or (v_result ->> 'id')::uuid <> v_checkin_a then
    raise exception 'ÉCHEC 5 : finalisation %', v_result;
  end if;
  execute 'set constraints all immediate';
  execute 'set constraints all deferred';

  -- 6. Idempotence : double soumission, aucun doublon
  perform public.save_checkin(v_base, true);
  select count(*) into v_count from public.daily_checkins where user_id = user_a;
  if v_count <> 1 then raise exception 'ÉCHEC 6 : % check-ins', v_count; end if;
  select count(*) into v_count from public.checkin_emotions where checkin_id = v_checkin_a;
  if v_count <> 2 then raise exception 'ÉCHEC 6 : % émotions', v_count; end if;

  -- 7. Précision conservée pour « other »
  select count(*) into v_count from public.checkin_triggers where checkin_id = v_checkin_a and custom_label = 'Précision';
  if v_count <> 1 then raise exception 'ÉCHEC 7 : précision « other » absente'; end if;

  -- 8. Un brouillon ne peut plus écraser un check-in terminé
  v_error := null;
  begin
    perform public.save_checkin(v_base, false);
  exception when others then v_error := sqlerrm;
  end;
  if v_error is distinct from 'checkin_already_completed' then raise exception 'ÉCHEC 8 : %', v_error; end if;

  -- 9. Un seul check-in par journée (contrainte unique, même en insertion directe)
  begin
    insert into public.daily_checkins (user_id, checkin_date, status) values (user_a, v_today, 'sober');
    raise exception 'ÉCHEC 9 : deux check-ins pour la même journée';
  exception when unique_violation then null;
  end;

  -- 10. Date future refusée
  v_error := null;
  begin
    perform public.save_checkin(jsonb_set(v_base, '{checkinDate}', to_jsonb((v_today + 1)::text)), true);
  exception when others then v_error := sqlerrm;
  end;
  if v_error is distinct from 'invalid_checkin_date' then raise exception 'ÉCHEC 10 : %', v_error; end if;

  -- 11. « consumed » sans événement refusé
  v_error := null;
  begin
    perform public.save_checkin(jsonb_set(v_base, '{status}', '"consumed"'), true);
  exception when others then v_error := sqlerrm;
  end;
  if v_error is distinct from 'consumption_event_required' then raise exception 'ÉCHEC 11 : %', v_error; end if;

  -- 12. « sober » avec événement refusé
  v_error := null;
  begin
    perform public.save_checkin(v_base || jsonb_build_object('consumptionEvents',
      jsonb_build_array(jsonb_build_object('userSubstanceId', v_cannabis_a))), true);
  exception when others then v_error := sqlerrm;
  end;
  if v_error is distinct from 'consumption_events_not_allowed' then raise exception 'ÉCHEC 12 : %', v_error; end if;

  -- 13. Modification sober → consumed : une seule substance sur deux, deux événements
  perform public.save_checkin(v_base || jsonb_build_object(
    'status', 'consumed',
    'consumptionEvents', jsonb_build_array(
      jsonb_build_object('userSubstanceId', v_cannabis_a, 'occurredAt', '18:00', 'cravingBefore', 8),
      jsonb_build_object('userSubstanceId', v_cannabis_a, 'occurredAt', '22:00', 'quantity', 1.5, 'unit', 'joint')
    )), true);
  execute 'set constraints all immediate';
  execute 'set constraints all deferred';
  select count(*) into v_count from public.consumption_events where checkin_id = v_checkin_a;
  if v_count <> 2 then raise exception 'ÉCHEC 13 : % événements', v_count; end if;
  select count(*) into v_count from public.daily_checkins where id = v_checkin_a and status = 'consumed' and completed_at is not null;
  if v_count <> 1 then raise exception 'ÉCHEC 13 : statut non modifié'; end if;

  -- 14. Modification consumed → sober : événements supprimés proprement
  perform public.save_checkin(v_base, true);
  execute 'set constraints all immediate';
  execute 'set constraints all deferred';
  select count(*) into v_count from public.consumption_events where checkin_id = v_checkin_a;
  if v_count <> 0 then raise exception 'ÉCHEC 14 : % événements orphelins', v_count; end if;

  -- 15. Cohérence garantie même hors RPC : événement direct sur un check-in « sober » terminé
  v_error := null;
  begin
    insert into public.consumption_events (checkin_id, user_substance_id) values (v_checkin_a, v_cannabis_a);
    execute 'set constraints all immediate';
  exception when others then v_error := sqlerrm;
  end;
  execute 'set constraints all deferred';
  if v_error is distinct from 'checkin_consumption_inconsistent' then raise exception 'ÉCHEC 15 : %', v_error; end if;

  -- 16. Substance d'un autre utilisateur refusée (RPC)
  v_error := null;
  begin
    perform public.save_checkin(v_base || jsonb_build_object('status', 'consumed',
      'consumptionEvents', jsonb_build_array(jsonb_build_object('userSubstanceId', v_cannabis_b))), true);
  exception when others then v_error := sqlerrm;
  end;
  if v_error is distinct from 'invalid_consumption_events' then raise exception 'ÉCHEC 16 : %', v_error; end if;

  -- 17. Substance d'un autre utilisateur refusée (clé étrangère composite, insertion directe)
  begin
    insert into public.consumption_events (checkin_id, user_substance_id) values (v_checkin_a, v_cannabis_b);
    raise exception 'ÉCHEC 17 : substance de B rattachée au check-in de A';
  exception when foreign_key_violation then null;
  end;

  -- 18. Un check-in terminé ne peut pas être supprimé
  delete from public.daily_checkins where id = v_checkin_a;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'ÉCHEC 18 : check-in terminé supprimé'; end if;

  -- 19. Journée passée acceptée (le modèle supporte l'historique)
  v_result := public.save_checkin(jsonb_set(v_base, '{checkinDate}', to_jsonb((v_today - 3)::text)), false);

  -- 20. Un brouillon peut être supprimé (« Recommencer »)
  delete from public.daily_checkins where id = (v_result ->> 'id')::uuid;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'ÉCHEC 20 : brouillon non supprimé'; end if;

  -- 21. Scores hors limites refusés (contrainte CHECK)
  v_error := null;
  begin
    perform public.save_checkin(jsonb_set(v_base, '{cravingScore}', '11'), true);
  exception when check_violation then v_error := 'check';
  end;
  if v_error is distinct from 'check' then raise exception 'ÉCHEC 21 : score hors limite accepté'; end if;

  -- Contexte : utilisateur B ---------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', user_b, 'role', 'authenticated')::text, true);

  -- 22-25. B ne voit rien de A
  select count(*) into v_count from public.daily_checkins;
  if v_count <> 0 then raise exception 'ÉCHEC 22 : B voit les check-ins de A'; end if;
  select count(*) into v_count from public.checkin_emotions;
  if v_count <> 0 then raise exception 'ÉCHEC 23 : B voit les émotions de A'; end if;
  select (select count(*) from public.checkin_triggers) + (select count(*) from public.checkin_achievements) into v_count;
  if v_count <> 0 then raise exception 'ÉCHEC 24 : B voit les déclencheurs / accomplissements de A'; end if;
  select count(*) into v_count from public.consumption_events;
  if v_count <> 0 then raise exception 'ÉCHEC 25 : B voit les consommations de A'; end if;

  -- 26. B ne peut ni modifier, ni rattacher une ligne au check-in de A
  update public.daily_checkins set notes = 'Pirate' where id = v_checkin_a;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'ÉCHEC 26 : B a modifié le check-in de A'; end if;
  v_error := null;
  begin
    insert into public.checkin_emotions (checkin_id, emotion_id)
    select v_checkin_a, e.id from public.emotions e where e.slug = 'joy';
  exception when others then v_error := sqlstate;
  end;
  if v_error is null then raise exception 'ÉCHEC 26 : B a ajouté une émotion au check-in de A'; end if;

  raise exception 'RLS_OK — checkins : 26 vérifications réussies (transaction annulée volontairement)';
end;
$$;
