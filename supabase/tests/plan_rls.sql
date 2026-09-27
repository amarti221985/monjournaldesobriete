-- =============================================================================
-- Vérification de « Mon plan » : RLS, contraintes, favoris, RPC (substances,
-- motivations, personne principale), isolation A / B par UUID deviné.
--
-- Usage :
--   npx supabase db query --linked -f supabase/tests/plan_rls.sql
--
-- Un seul bloc atomique qui se termine TOUJOURS par une exception : toutes les
-- écritures (utilisateurs fictifs compris) sont annulées.
--
-- Résultat attendu (affiché comme une erreur, c'est voulu) :
--   RLS_OK — plan : 22 vérifications réussies (transaction annulée volontairement)
-- =============================================================================

do $$
declare
  user_a constant uuid := '00000000-0000-4000-8000-0000000000a8';
  user_b constant uuid := '00000000-0000-4000-8000-0000000000b8';
  v_today date := (now() at time zone 'America/Toronto')::date;
  v_cannabis uuid;
  v_nicotine uuid;
  v_event uuid;
  v_contact_1 uuid;
  v_contact_2 uuid;
  v_strategy uuid;
  v_place uuid;
  v_letter uuid;
  v_count integer;
  v_error text;
begin
  insert into auth.users (id, aud, role, email, raw_user_meta_data) values
    (user_a, 'authenticated', 'authenticated', 'plan-test-a@example.invalid', '{"display_name":"A","timezone":"America/Toronto"}'),
    (user_b, 'authenticated', 'authenticated', 'plan-test-b@example.invalid', '{"display_name":"B","timezone":"America/Toronto"}');

  insert into public.user_substances (user_id, substance_id, goal, started_on, is_primary)
  select user_a, s.id, 'abstinence', v_today - 20, true from public.substances s where s.slug = 'cannabis'
  returning id into v_cannabis;
  insert into public.personal_reasons (user_id, reason_text) values (user_a, 'Raison fictive.');
  insert into public.user_motivations (user_id, motivation) values (user_a, 'health');

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);

  -- 1. Ajout de la nicotine (réduction)
  v_nicotine := public.add_user_substance(jsonb_build_object('slug', 'nicotine', 'goal', 'reduction', 'startedOn', v_today - 5));
  select count(*) into v_count from public.user_substances where is_active;
  if v_count <> 2 then raise exception 'ÉCHEC 1 : % substances actives', v_count; end if;

  -- 2. Même substance active deux fois : refusée
  begin
    perform public.add_user_substance(jsonb_build_object('slug', 'nicotine', 'goal', 'observation', 'startedOn', v_today));
    raise exception 'ÉCHEC 2 : doublon accepté';
  exception when unique_violation then null;
  end;

  -- 3. Date de départ future refusée
  v_error := null;
  begin
    perform public.add_user_substance(jsonb_build_object('slug', 'alcohol', 'goal', 'reduction', 'startedOn', v_today + 1));
  exception when others then v_error := sqlerrm;
  end;
  if v_error is distinct from 'invalid_started_on' then raise exception 'ÉCHEC 3 : %', v_error; end if;

  -- 4. Historique nicotine (moment d'envie terminé) puis modification objectif / date
  perform public.start_craving_event(jsonb_build_object('id', gen_random_uuid(), 'initialCravingScore', 6,
    'substanceIds', jsonb_build_array(v_nicotine)));
  select craving_event_id into v_event from public.craving_event_substances where user_substance_id = v_nicotine;
  update public.user_substances set goal = 'abstinence', started_on = v_today - 3 where id = v_nicotine;
  select count(*) into v_count from public.craving_event_substances where user_substance_id = v_nicotine;
  if v_count <> 1 then raise exception 'ÉCHEC 4 : historique modifié'; end if;

  -- 5. La substance principale ne peut pas être désactivée
  v_error := null;
  begin
    perform public.deactivate_user_substance(v_cannabis);
  exception when others then v_error := sqlerrm;
  end;
  if v_error is distinct from 'primary_substance' then raise exception 'ÉCHEC 5 : %', v_error; end if;

  -- 6. Désactivation de la nicotine : cannabis reste principal, historique intact
  perform public.deactivate_user_substance(v_nicotine);
  if exists (select 1 from public.user_substances where id = v_nicotine and is_active) then raise exception 'ÉCHEC 6 : toujours active'; end if;
  if not exists (select 1 from public.user_substances where id = v_cannabis and is_primary) then raise exception 'ÉCHEC 6 : principale perdue'; end if;
  select count(*) into v_count from public.craving_event_substances where user_substance_id = v_nicotine;
  if v_count <> 1 then raise exception 'ÉCHEC 6 : historique supprimé'; end if;

  -- 7. Substance désactivée : plus proposée pour un nouveau moment
  v_error := null;
  begin
    perform public.start_craving_event(jsonb_build_object('id', gen_random_uuid(), 'initialCravingScore', 4,
      'substanceIds', jsonb_build_array(v_nicotine)));
  exception when others then v_error := sqlerrm;
  end;
  if v_error is distinct from 'invalid_substances' then raise exception 'ÉCHEC 7 : %', v_error; end if;

  -- 8. La dernière substance suivie ne peut pas être désactivée ; changement de principale
  perform public.set_primary_substance(v_cannabis);
  v_error := null;
  begin
    update public.user_substances set is_primary = false where id = v_cannabis;
    perform public.deactivate_user_substance(v_cannabis);
  exception when others then v_error := sqlerrm;
  end;
  if v_error is distinct from 'last_substance' then raise exception 'ÉCHEC 8 : %', v_error; end if;
  perform public.set_primary_substance(v_cannabis);

  -- 9. Motivations : au moins une ; précision « other »
  v_error := null;
  begin
    perform public.set_user_motivations(jsonb_build_object('motivations', '[]'::jsonb));
  exception when others then v_error := sqlerrm;
  end;
  if v_error is distinct from 'motivation_required' then raise exception 'ÉCHEC 9 : %', v_error; end if;
  perform public.set_user_motivations(jsonb_build_object('motivations', jsonb_build_array('freedom', 'other'), 'otherLabel', 'Précision'));
  select count(*) into v_count from public.user_motivations where motivation = 'other' and custom_label = 'Précision';
  if v_count <> 1 then raise exception 'ÉCHEC 9 : motivations non remplacées'; end if;

  -- 10. Déclencheurs personnels : catalogue + personnel ; doublon catalogue refusé ; XOR
  insert into public.user_personal_triggers (user_id, trigger_type_id)
  select user_a, t.id from public.trigger_types t where t.slug in ('stress', 'loneliness');
  insert into public.user_personal_triggers (user_id, custom_label, notes) values (user_a, 'Fin de soirée seul', 'Note fictive.');
  begin
    insert into public.user_personal_triggers (user_id, trigger_type_id) select user_a, t.id from public.trigger_types t where t.slug = 'stress';
    raise exception 'ÉCHEC 10 : doublon accepté';
  exception when unique_violation then null;
  end;
  begin
    insert into public.user_personal_triggers (user_id) values (user_a);
    raise exception 'ÉCHEC 10 : déclencheur vide accepté';
  exception when check_violation then null;
  end;

  -- 11. Stratégies : durée hors liste refusée
  begin
    insert into public.user_personal_strategies (user_id, custom_name, default_duration_minutes) values (user_a, 'Test', 7);
    raise exception 'ÉCHEC 11 : durée 7 acceptée';
  exception when check_violation then null;
  end;

  -- 12. 3 favoris acceptés, le 4e refusé par la base
  insert into public.user_personal_strategies (user_id, strategy_id, is_favorite, default_duration_minutes)
  select user_a, s.id, true, 20 from public.craving_strategies s where s.slug in ('walk', 'music');
  insert into public.user_personal_strategies (user_id, custom_name, is_favorite) values (user_a, 'Aller chez ma sœur', true)
  returning id into v_strategy;
  v_error := null;
  begin
    insert into public.user_personal_strategies (user_id, strategy_id, is_favorite)
    select user_a, s.id, true from public.craving_strategies s where s.slug = 'breathe';
  exception when others then v_error := sqlerrm;
  end;
  if v_error is distinct from 'too_many_favorites' then raise exception 'ÉCHEC 12 : %', v_error; end if;

  -- 13. Lieux sûrs : texte seulement ; 4e favori refusé
  insert into public.safe_places (user_id, name, is_favorite) values (user_a, 'Parc près de chez moi', true) returning id into v_place;
  insert into public.safe_places (user_id, name, is_favorite) values (user_a, 'Chez un proche', true), (user_a, 'Bibliothèque', true);
  v_error := null;
  begin
    insert into public.safe_places (user_id, name, is_favorite) values (user_a, 'Gym', true);
  exception when others then v_error := sqlerrm;
  end;
  if v_error is distinct from 'too_many_favorites' then raise exception 'ÉCHEC 13 : %', v_error; end if;

  -- 14. Personne principale : une seule
  insert into public.support_contacts (user_id, name, relationship) values (user_a, 'Marie', 'Sœur') returning id into v_contact_1;
  insert into public.support_contacts (user_id, name, phone) values (user_a, 'Sam', '514 555-0100') returning id into v_contact_2;
  perform public.set_primary_support_contact(v_contact_1);
  perform public.set_primary_support_contact(v_contact_2);
  select count(*) into v_count from public.support_contacts where is_primary;
  if v_count <> 1 or not exists (select 1 from public.support_contacts where id = v_contact_2 and is_primary) then
    raise exception 'ÉCHEC 14 : % personnes principales', v_count;
  end if;

  -- 15. Rappel et lettre : un seul par utilisateur, longueurs
  insert into public.personal_reminders (user_id, content) values (user_a, 'Je peux traverser ce moment.');
  begin
    insert into public.personal_reminders (user_id, content) values (user_a, 'Deuxième');
    raise exception 'ÉCHEC 15 : deux rappels';
  exception when unique_violation then null;
  end;
  insert into public.self_letters (user_id, title, content) values (user_a, null, 'Lettre fictive.') returning id into v_letter;
  begin
    update public.self_letters set content = repeat('a', 5001) where id = v_letter;
    raise exception 'ÉCHEC 15 : lettre trop longue acceptée';
  exception when check_violation then null;
  end;

  -- Contexte : utilisateur B ---------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', user_b, 'role', 'authenticated')::text, true);

  -- 16. B ne lit aucune donnée du plan de A
  select (select count(*) from public.user_personal_triggers) + (select count(*) from public.user_personal_strategies)
       + (select count(*) from public.safe_places) + (select count(*) from public.personal_reminders)
       + (select count(*) from public.self_letters) + (select count(*) from public.support_contacts)
       + (select count(*) from public.personal_reasons) + (select count(*) from public.user_motivations)
       + (select count(*) from public.user_substances)
    into v_count;
  if v_count <> 0 then raise exception 'ÉCHEC 16 : B voit % lignes', v_count; end if;

  -- 17. B ne modifie ni ne supprime rien de A (UUID devinés)
  update public.self_letters set content = 'Piraté' where id = v_letter;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'ÉCHEC 17 : lettre modifiée'; end if;
  delete from public.safe_places where id = v_place;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'ÉCHEC 17 : lieu supprimé'; end if;
  update public.user_personal_strategies set is_favorite = false where id = v_strategy;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'ÉCHEC 17 : stratégie modifiée'; end if;

  -- 18. B ne peut pas désigner le contact de A comme principal
  v_error := null;
  begin
    perform public.set_primary_support_contact(v_contact_1);
  exception when others then v_error := sqlerrm;
  end;
  if v_error is distinct from 'support_contact_not_found' then raise exception 'ÉCHEC 18 : %', v_error; end if;

  -- 19. B ne peut ni désactiver ni rendre principale la substance de A
  v_error := null;
  begin
    perform public.deactivate_user_substance(v_cannabis);
  exception when others then v_error := sqlerrm;
  end;
  if v_error is distinct from 'user_substance_not_found' then raise exception 'ÉCHEC 19 : %', v_error; end if;
  v_error := null;
  begin
    perform public.set_primary_substance(v_cannabis);
  exception when others then v_error := sqlerrm;
  end;
  if v_error is distinct from 'user_substance_not_found' then raise exception 'ÉCHEC 19 : %', v_error; end if;

  -- 20. B ne peut pas insérer une ligne au nom de A
  begin
    insert into public.safe_places (user_id, name) values (user_a, 'Intrus');
    raise exception 'ÉCHEC 20 : insertion au nom de A';
  exception when insufficient_privilege then null;
  end;

  -- 21. Les motivations de B n'affectent pas celles de A
  perform public.set_user_motivations(jsonb_build_object('motivations', jsonb_build_array('health')));
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);
  select count(*) into v_count from public.user_motivations;
  if v_count <> 2 then raise exception 'ÉCHEC 21 : motivations de A modifiées (%)', v_count; end if;

  -- 22. Le plan de A est intact
  select count(*) into v_count from public.safe_places;
  if v_count <> 3 then raise exception 'ÉCHEC 22 : % lieux', v_count; end if;

  raise exception 'RLS_OK — plan : 22 vérifications réussies (transaction annulée volontairement)';
end;
$$;
