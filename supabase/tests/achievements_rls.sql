-- =============================================================================
-- Vérification des accomplissements : rattrapage de l'historique, définitions (sobriété
-- cumulée, série, check-ins, réflexions, déclencheurs, émotions, interventions,
-- stratégies distinctes, plan), persistance, idempotence, sécurité et isolation.
--
-- Usage :
--   npx supabase db query --linked -f supabase/tests/achievements_rls.sql
--
-- Un seul bloc atomique qui se termine TOUJOURS par une exception : toutes les
-- écritures (utilisateurs fictifs compris) sont annulées.
--
-- Résultat attendu (affiché comme une erreur, c'est voulu) :
--   RLS_OK — achievements : 24 vérifications réussies (transaction annulée volontairement)
-- =============================================================================

do $$
declare
  user_a constant uuid := '00000000-0000-4000-8000-0000000000a9';
  user_b constant uuid := '00000000-0000-4000-8000-0000000000b9';
  v_today date := (now() at time zone 'America/Toronto')::date;
  v_cannabis uuid;
  v_date date;
  v_status text;
  v_consumed_days int[] := array[10, 20, 30, 40, 45, 48, 50];
  v_result jsonb;
  v_progress jsonb;
  v_count integer;
  v_event uuid;
  v_first_checkin uuid;
  v_slugs text[];
begin
  insert into auth.users (id, aud, role, email, raw_user_meta_data) values
    (user_a, 'authenticated', 'authenticated', 'ach-test-a@example.invalid', '{"display_name":"A","timezone":"America/Toronto"}'),
    (user_b, 'authenticated', 'authenticated', 'ach-test-b@example.invalid', '{"display_name":"B","timezone":"America/Toronto"}');
  insert into public.user_substances (user_id, substance_id, goal, started_on, is_primary)
  select user_a, s.id, 'abstinence', v_today - 60, true from public.substances s where s.slug = 'cannabis'
  returning id into v_cannabis;
  insert into public.personal_reasons (user_id, reason_text) values (user_a, 'Raison fictive.');
  insert into public.user_motivations (user_id, motivation) values (user_a, 'health');

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);

  -- Historique : 52 check-ins (45 sobres, 7 consommations), 12 réflexions, 6 journées avec
  -- émotion, 3 journées avec déclencheur (dont une avec 4 déclencheurs).
  for i in 0..51 loop
    v_date := v_today - 51 + i;
    v_status := case when i = any (v_consumed_days) then 'consumed' else 'sober' end;
    perform public.save_checkin(jsonb_build_object(
      'checkinDate', v_date, 'status', v_status,
      'moodScore', 6, 'energyScore', 6, 'stressScore', 5, 'cravingScore', 4,
      'emotions', case when i < 6 then jsonb_build_array('calm') else '[]'::jsonb end,
      'triggers', case
        when i = 0 then jsonb_build_array(jsonb_build_object('slug', 'stress'), jsonb_build_object('slug', 'work'),
                                          jsonb_build_object('slug', 'fatigue'), jsonb_build_object('slug', 'boredom'))
        when i in (1, 2) then jsonb_build_array(jsonb_build_object('slug', 'stress'))
        else '[]'::jsonb end,
      'lessonText', case when i < 12 then 'Réflexion fictive.' end,
      'victoryText', case when i < 2 then 'Victoire fictive.' end,
      'consumptionEvents', case when v_status = 'consumed' then jsonb_build_array(jsonb_build_object('userSubstanceId', v_cannabis)) else '[]'::jsonb end
    ), true);
  end loop;
  -- Un champ contenant seulement des espaces ne compte pas comme réflexion.
  update public.daily_checkins set notes = '   ' where checkin_date = v_today;

  -- 4 interventions terminées (dont 8 → 9) + 1 en cours ; stratégies : marcher ×2, musique, personnelle.
  for i in 1..4 loop
    v_event := gen_random_uuid();
    perform public.start_craving_event(jsonb_build_object('id', v_event, 'initialCravingScore', 8, 'substanceIds', jsonb_build_array(v_cannabis)));
    perform public.start_craving_intervention(v_event, case
      when i <= 2 then jsonb_build_object('strategySlug', 'walk')
      when i = 3 then jsonb_build_object('strategySlug', 'music')
      else jsonb_build_object('customStrategyText', 'Stratégie fictive') end);
    perform public.complete_craving_event(v_event, jsonb_build_object('finalCravingScore', case when i = 1 then 9 else 5 end));
  end loop;
  perform public.start_craving_event(jsonb_build_object('id', gen_random_uuid(), 'initialCravingScore', 7, 'substanceIds', jsonb_build_array(v_cannabis)));

  -- 1. Métriques calculées (mêmes définitions que l'application)
  v_progress := public.get_achievement_progress();
  if (v_progress ->> 'checkins')::int <> 52 or (v_progress ->> 'sober_days')::int <> 45
     or (v_progress ->> 'best_streak')::int <> 10 or (v_progress ->> 'reflection_days')::int <> 12
     or (v_progress ->> 'trigger_days')::int <> 3 or (v_progress ->> 'emotion_days')::int <> 6
     or (v_progress ->> 'craving_interventions')::int <> 4 or (v_progress ->> 'strategies_tried')::int <> 3
     or (v_progress ->> 'victory_days')::int <> 2 then
    raise exception 'ÉCHEC 1 : métriques %', v_progress;
  end if;

  -- 2. Rattrapage : première attribution marquée « initial »
  v_result := public.award_achievements();
  if not (v_result ->> 'initial')::boolean then raise exception 'ÉCHEC 2 : initial attendu'; end if;
  select array_agg(d.slug order by d.slug) into v_slugs
    from public.user_achievements ua join public.achievement_definitions d on d.id = ua.achievement_definition_id;

  -- 3. Jours sobres cumulés 45 → 1, 3, 7, 14, 30 (pas 60)
  if not (v_slugs @> array['sober-days-1', 'sober-days-3', 'sober-days-7', 'sober-days-14', 'sober-days-30'])
     or 'sober-days-60' = any (v_slugs) then
    raise exception 'ÉCHEC 3 : %', v_slugs;
  end if;
  -- 4. Série : meilleure série 10 → 7 seulement
  if not ('streak-7' = any (v_slugs)) or 'streak-14' = any (v_slugs) then raise exception 'ÉCHEC 4 : %', v_slugs; end if;
  -- 5. 52 check-ins (dont 7 consommations) → jusqu'à 30
  if not (v_slugs @> array['checkins-1', 'checkins-3', 'checkins-7', 'checkins-14', 'checkins-30']) or 'checkins-60' = any (v_slugs) then
    raise exception 'ÉCHEC 5 : %', v_slugs;
  end if;
  -- 6. 12 réflexions → 1, 5, 10 (l'espace seul ne compte pas)
  if not (v_slugs @> array['reflections-1', 'reflections-5', 'reflections-10']) or 'reflections-25' = any (v_slugs) then
    raise exception 'ÉCHEC 6 : %', v_slugs;
  end if;
  -- 7. Déclencheurs : 3 JOURNÉES (4 déclencheurs un même jour comptent pour 1) → trigger-days-1 seulement
  if not ('trigger-days-1' = any (v_slugs)) or 'trigger-days-5' = any (v_slugs) then raise exception 'ÉCHEC 7 : %', v_slugs; end if;
  -- 8. Émotions : 6 journées → emotion-days-5
  if not ('emotion-days-5' = any (v_slugs)) then raise exception 'ÉCHEC 8 : %', v_slugs; end if;
  -- 9. Interventions : 4 terminées (dont 8 → 9), la 5e en cours ne compte pas → 1 et 3
  if not (v_slugs @> array['craving-interventions-1', 'craving-interventions-3']) or 'craving-interventions-10' = any (v_slugs) then
    raise exception 'ÉCHEC 9 : %', v_slugs;
  end if;
  -- 10. Stratégies distinctes : marcher ×2 = 1 → 3 distinctes
  if not ('strategies-tried-3' = any (v_slugs)) or 'strategies-tried-5' = any (v_slugs) then raise exception 'ÉCHEC 10 : %', v_slugs; end if;
  -- 11. Plan : raison présente → plan-reason ; 1 motivation → pas plan-motivations-3
  if not ('plan-reason' = any (v_slugs)) or 'plan-motivations-3' = any (v_slugs) then raise exception 'ÉCHEC 11 : %', v_slugs; end if;

  -- 12. Dates : check-ins → « exact » (completed_at du N-ième) ; plan → « attribution »
  select count(*) into v_count from public.user_achievements ua join public.achievement_definitions d on d.id = ua.achievement_definition_id
   where (d.metric like 'plan_%' and ua.metadata ->> 'date_source' <> 'attribution')
      or (d.metric not like 'plan_%' and ua.metadata ->> 'date_source' <> 'exact');
  if v_count <> 0 then raise exception 'ÉCHEC 12 : % dates mal qualifiées', v_count; end if;
  select count(*) into v_count from public.user_achievements ua join public.achievement_definitions d on d.id = ua.achievement_definition_id
   where d.slug = 'checkins-30'
     and ua.earned_at = (select completed_at from public.daily_checkins order by completed_at, id offset 29 limit 1);
  if v_count <> 1 then raise exception 'ÉCHEC 12 : date du 30e check-in'; end if;

  -- 13. Métadonnées sans contenu personnel
  select count(*) into v_count from public.user_achievements
   where exists (select 1 from jsonb_object_keys(metadata) k where k not in ('metric', 'threshold', 'date_source'));
  if v_count <> 0 then raise exception 'ÉCHEC 13 : métadonnées inattendues'; end if;

  -- 14. Idempotence : 10 évaluations, aucun doublon, plus « initial »
  select count(*) into v_count from public.user_achievements;
  for i in 1..10 loop
    v_result := public.award_achievements();
  end loop;
  if (select count(*) from public.user_achievements) <> v_count or jsonb_array_length(v_result -> 'awarded') <> 0
     or (v_result ->> 'initial')::boolean then
    raise exception 'ÉCHEC 14 : idempotence';
  end if;

  -- 15. Une consommation ne retire rien : un jour sobre devient « consommation »
  select id into v_first_checkin from public.daily_checkins where checkin_date = v_today - 51;
  perform public.save_checkin(jsonb_build_object('checkinDate', v_today - 51, 'status', 'consumed',
    'moodScore', 5, 'energyScore', 5, 'stressScore', 7, 'cravingScore', 8,
    'consumptionEvents', jsonb_build_array(jsonb_build_object('userSubstanceId', v_cannabis))), true);
  v_progress := public.get_achievement_progress();
  if (v_progress ->> 'sober_days')::int <> 44 then raise exception 'ÉCHEC 15 : % jours sobres', v_progress ->> 'sober_days'; end if;
  perform public.award_achievements();
  select count(*) into v_count from public.user_achievements ua join public.achievement_definitions d on d.id = ua.achievement_definition_id
   where d.slug in ('sober-days-30', 'streak-7');
  if v_count <> 2 then raise exception 'ÉCHEC 15 : accomplissement retiré'; end if;

  -- 16. Plan : lettre créée → obtenu ; supprimée → reste ; raison modifiée → reste
  insert into public.self_letters (user_id, content) values (user_a, 'Lettre fictive.');
  v_result := public.award_achievements();
  if not (v_result -> 'awarded' @> '[{"slug": "plan-letter"}]') then raise exception 'ÉCHEC 16 : %', v_result; end if;
  delete from public.self_letters where user_id = user_a;
  update public.personal_reasons set reason_text = 'Raison modifiée.' where user_id = user_a;
  perform public.award_achievements();
  select count(*) into v_count from public.user_achievements ua join public.achievement_definitions d on d.id = ua.achievement_definition_id
   where d.slug in ('plan-letter', 'plan-reason');
  if v_count <> 2 then raise exception 'ÉCHEC 16 : accomplissement de plan retiré'; end if;

  -- 17. Aucune auto-attribution : insertion directe refusée
  begin
    insert into public.user_achievements (user_id, achievement_definition_id, earned_at)
    select user_a, d.id, now() from public.achievement_definitions d where d.slug = 'sober-days-365';
    raise exception 'ÉCHEC 17 : auto-attribution acceptée';
  exception when insufficient_privilege then null;
  end;

  -- 18. Ni modification ni suppression de ses accomplissements
  begin
    update public.user_achievements set earned_at = now() - interval '1 year';
    raise exception 'ÉCHEC 18 : date modifiable';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.user_achievements;
    raise exception 'ÉCHEC 18 : suppression autorisée';
  exception when insufficient_privilege then null;
  end;

  -- 19. Catalogue non modifiable
  begin
    update public.achievement_definitions set threshold = 1 where slug = 'sober-days-365';
    raise exception 'ÉCHEC 19 : catalogue modifiable';
  exception when insufficient_privilege then null;
  end;

  -- 20. Fonctions internes inaccessibles (elles lisent n'importe quel utilisateur)
  begin
    perform * from public.achievement_metric_events(user_b);
    raise exception 'ÉCHEC 20 : métriques internes accessibles';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.award_achievements_for(user_b);
    raise exception 'ÉCHEC 20 : attribution interne accessible';
  exception when insufficient_privilege then null;
  end;

  -- Contexte : utilisateur B ---------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', user_b, 'role', 'authenticated')::text, true);

  -- 21. B ne voit aucun accomplissement de A
  select count(*) into v_count from public.user_achievements;
  if v_count <> 0 then raise exception 'ÉCHEC 21 : B voit % accomplissements', v_count; end if;

  -- 22. Métriques de B : les siennes seulement (aucune donnée)
  v_progress := public.get_achievement_progress();
  if v_progress ? 'checkins' or v_progress ? 'sober_days' then raise exception 'ÉCHEC 22 : %', v_progress; end if;

  -- 23. L'évaluation de B n'attribue rien à B à partir des données de A
  v_result := public.award_achievements();
  if jsonb_array_length(v_result -> 'awarded') <> 0 then raise exception 'ÉCHEC 23 : %', v_result; end if;

  -- 24. B ne peut rien attribuer à A
  begin
    insert into public.user_achievements (user_id, achievement_definition_id, earned_at)
    select user_a, d.id, now() from public.achievement_definitions d where d.slug = 'checkins-365';
    raise exception 'ÉCHEC 24 : attribution à A acceptée';
  exception when insufficient_privilege then null;
  end;

  raise exception 'RLS_OK — achievements : 24 vérifications réussies (transaction annulée volontairement)';
end;
$$;
