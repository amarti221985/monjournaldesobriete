-- =============================================================================
-- Vérification de l'administration (Admin V1) : rôle contrôlé par le serveur, aucune
-- auto-promotion, RPC refusées aux non-admins, agrégats exacts (exclusions, entonnoir,
-- rétention, cohortes immatures), aucun texte privé ni courriel dans les sorties, audit,
-- suppression de compte, et performance avec 1 000 comptes fictifs.
--
-- Usage :
--   npx supabase db query --linked -f supabase/tests/admin_rls.sql
--
-- Un seul bloc atomique qui se termine TOUJOURS par une exception : toutes les écritures
-- (utilisateurs fictifs compris) sont annulées. Aucune donnée réelle.
--
-- Résultat attendu (affiché comme une erreur, c'est voulu) :
--   RLS_OK — admin : 30 vérifications réussies (… ms) (transaction annulée volontairement)
-- =============================================================================

do $$
declare
  user_a constant uuid := '00000000-0000-4000-8000-0000000000ae';
  user_b constant uuid := '00000000-0000-4000-8000-0000000000be';
  user_n constant uuid := '00000000-0000-4000-8000-0000000000ce';
  admin_c constant uuid := '00000000-0000-4000-8000-0000000000de';
  user_x constant uuid := '00000000-0000-4000-8000-0000000000ee';
  secret constant text := 'PRIVATE_SECRET_SENTENCE';
  v_today date := (now() at time zone 'UTC')::date;
  v_error text;
  v_count integer;
  v_text text;
  v_bool boolean;
  v_code_a text;
  v_feedback uuid;
  v_t0 timestamptz;
  v_perf text := '';
  v_rec record;
begin
  -- Isolation : les comptes déjà présents dans la base sont exclus des statistiques pendant ce
  -- test seulement (la transaction est annulée à la fin).
  insert into public.analytics_excluded_users (user_id, reason)
  select u.id, 'Isolation du test' from auth.users u on conflict (user_id) do nothing;

  -- Comptes fictifs : A inscrit il y a 10 jours, B il y a 2 jours, N aujourd'hui (onboarding
  -- incomplet), C administrateur, X compte de test exclu.
  insert into auth.users (id, aud, role, email, created_at, raw_user_meta_data) values
    (user_a, 'authenticated', 'authenticated', 'adm-test-a@example.invalid', now() - interval '10 days', '{"display_name":"A","timezone":"America/Toronto"}'),
    (user_b, 'authenticated', 'authenticated', 'adm-test-b@example.invalid', now() - interval '2 days', '{"display_name":"B","timezone":"America/Toronto"}'),
    (user_n, 'authenticated', 'authenticated', 'adm-test-n@example.invalid', now(), '{"display_name":"N","timezone":"America/Toronto"}'),
    (admin_c, 'authenticated', 'authenticated', 'adm-test-c@example.invalid', now() - interval '20 days', '{"display_name":"C","timezone":"America/Toronto"}'),
    (user_x, 'authenticated', 'authenticated', 'adm-test-x@example.invalid', now() - interval '5 days', '{"display_name":"X","timezone":"America/Toronto"}');
  -- Données minimales de l'onboarding (garde-fou ADR-028) ; la raison de A est un texte secret.
  insert into public.user_substances (user_id, substance_id, goal, started_on, is_primary)
  select u, s.id, 'abstinence', v_today - 20, true
    from unnest(array[user_a, user_b, admin_c, user_x]) as u cross join public.substances s where s.slug = 'cannabis';
  insert into public.personal_reasons (user_id, reason_text)
  select u, case when u = user_a then secret else 'Raison fictive.' end from unnest(array[user_a, user_b, admin_c, user_x]) as u;
  insert into public.user_motivations (user_id, motivation) select u, 'health' from unnest(array[user_a, user_b, admin_c, user_x]) as u;
  update public.profiles set onboarding_completed = true where id in (user_a, user_b, admin_c, user_x);
  insert into public.admin_users (user_id, role) values (admin_c, 'admin');
  insert into public.analytics_excluded_users (user_id, reason) values (user_x, 'Compte de test fictif');

  -- A : activité aux jours 0, 1, 3 et 7 après l'inscription, textes secrets partout.
  insert into public.daily_checkins (user_id, checkin_date, status, mood_score, energy_score, stress_score, craving_score,
                                     victory_text, notes, completed_at, created_at, updated_at)
  select user_a, v_today - 10 + d, 'sober', 6, 6, 5, 3, secret, secret,
         now() - interval '10 days' + make_interval(days => d), now() - interval '10 days' + make_interval(days => d),
         now() - interval '10 days' + make_interval(days => d)
    from unnest(array[0, 1, 3, 7]) as d;
  insert into public.self_letters (user_id, content) values (user_a, secret);
  insert into public.support_contacts (user_id, name, phone) values (user_a, secret, '514-555-0100');
  -- B : un check-in aujourd'hui. C (admin) et X (exclu) : des check-ins qui ne doivent pas compter.
  insert into public.daily_checkins (user_id, checkin_date, status, mood_score, energy_score, stress_score, craving_score, completed_at)
  values (user_b, v_today, 'sober', 5, 5, 5, 5, now()), (admin_c, v_today, 'sober', 5, 5, 5, 5, now()),
         (user_x, v_today, 'sober', 5, 5, 5, 5, now());
  insert into public.beta_feedback (user_id, category, message) values (user_b, 'suggestion', 'Avis fictif de B.') returning id into v_feedback;
  insert into public.beta_feedback (user_id, category, message) values (admin_c, 'bug', 'Avis fictif de C.');

  perform set_config('role', 'authenticated', true);

  -- Contexte : A (non admin) --------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);

  -- 1. is_admin() faux
  if public.is_admin() then raise exception 'ÉCHEC 1 : A est admin'; end if;

  -- 2. Aucun accès à admin_users (lecture, insertion, modification)
  begin perform 1 from public.admin_users; raise exception 'ÉCHEC 2 : lecture admin_users';
  exception when insufficient_privilege then null; end;
  begin insert into public.admin_users (user_id, role) values (user_a, 'owner'); raise exception 'ÉCHEC 3 : auto-promotion';
  exception when insufficient_privilege then null; end;
  begin update public.admin_users set role = 'owner'; raise exception 'ÉCHEC 4 : modification de rôle';
  exception when insufficient_privilege then null; end;

  -- 5–6. Ni journal d'audit, ni exclusions
  begin perform 1 from public.admin_audit_log; raise exception 'ÉCHEC 5 : audit lisible';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.analytics_excluded_users; raise exception 'ÉCHEC 6 : exclusions lisibles';
  exception when insufficient_privilege then null; end;

  -- 7. Les 10 RPC admin refusées
  for v_rec in select * from (values
    ('select count(*) from public.admin_overview(now() - interval ''30 days'', now())'),
    ('select count(*) from public.admin_timeseries(now() - interval ''30 days'', now(), ''day'')'),
    ('select count(*) from public.admin_funnel(now() - interval ''30 days'', now())'),
    ('select count(*) from public.admin_retention()'),
    ('select count(*) from public.admin_feature_adoption(now() - interval ''30 days'', now())'),
    ('select count(*) from public.admin_users_page(''all'', ''recent'', 25, 0, 7, 7, 14)'),
    ('select count(*) from public.admin_user_detail(''ABCDEF12'')'),
    ('select public.admin_reveal_account_email(''ABCDEF12'')'),
    ('select count(*) from public.admin_feedback_page(null, null, 25, 0)'),
    ('select public.admin_set_feedback_status(''' || v_feedback || ''', ''resolved'')')
  ) as t(q) loop
    v_error := null;
    begin execute v_rec.q; exception when others then v_error := sqlerrm; end;
    if v_error is distinct from 'admin_required' then raise exception 'ÉCHEC 7 : RPC accessible à A (%) : %', v_error, v_rec.q; end if;
  end loop;

  -- 8. Événements produit : écriture par la RPC seulement, liste fermée, lecture de soi uniquement
  perform public.record_product_event('plan_updated');
  perform public.record_product_event('plan_updated'); -- même jour : pas de doublon
  select count(*) into v_count from public.product_events where user_id = user_a;
  if v_count <> 1 then raise exception 'ÉCHEC 8 : % événement(s)', v_count; end if;
  v_error := null;
  begin perform public.record_product_event('page_view'); exception when others then v_error := sqlerrm; end;
  if v_error is distinct from 'invalid_event' then raise exception 'ÉCHEC 9 : événement libre accepté'; end if;
  begin insert into public.product_events (user_id, event_name) values (user_a, 'plan_updated'); raise exception 'ÉCHEC 10 : insertion directe';
  exception when insufficient_privilege then null; end;

  -- 11. Statut d'un avis : non modifiable par un utilisateur
  begin update public.beta_feedback set status = 'resolved'; raise exception 'ÉCHEC 11 : statut modifiable';
  exception when insufficient_privilege then null; end;

  -- Contexte : B (non admin) --------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', user_b, 'role', 'authenticated')::text, true);
  select count(*) into v_count from public.product_events where user_id = user_a;
  if v_count <> 0 then raise exception 'ÉCHEC 12 : B lit les événements de A'; end if;
  select count(*) into v_count from public.beta_feedback where user_id = admin_c;
  if v_count <> 0 then raise exception 'ÉCHEC 13 : B lit les avis de C'; end if;

  -- Contexte : C (admin) ------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', admin_c, 'role', 'authenticated')::text, true);
  if not public.is_admin() then raise exception 'ÉCHEC 14 : C non admin'; end if;

  -- 15. Indicateurs : C (admin) et X (exclu) ne comptent pas
  select * into v_rec from public.admin_overview('-infinity', now() + interval '1 minute');
  if v_rec.total_users <> 3 or v_rec.onboarded_total <> 2 or v_rec.first_checkin_total <> 2 or v_rec.checkins <> 5
     or v_rec.feedback_total <> 1 or v_rec.users_3_checkins <> 1 then
    raise exception 'ÉCHEC 15 : indicateurs %', row_to_json(v_rec);
  end if;
  -- 16. Période de 7 jours : nouveaux B et N ; actifs B et A (plan modifié aujourd'hui)
  select * into v_rec from public.admin_overview(now() - interval '7 days', now() + interval '1 minute');
  if v_rec.new_users <> 2 or v_rec.active_users <> 2 then raise exception 'ÉCHEC 16 : période %', row_to_json(v_rec); end if;

  -- 17. Entonnoir : 3 inscrits → 2 onboarding → 2 premiers check-ins → 1 retour → J7 : 1 / 1 éligible
  select * into v_rec from public.admin_funnel('-infinity', now() + interval '1 minute');
  if v_rec.signups <> 3 or v_rec.onboarded <> 2 or v_rec.first_checkin <> 2 or v_rec.returned <> 1
     or v_rec.j7_eligible <> 1 or v_rec.active_j7 <> 1 then
    raise exception 'ÉCHEC 17 : entonnoir %', row_to_json(v_rec);
  end if;

  -- 18–19. Rétention : A (jours 0,1,3,7 + plan aujourd'hui = jour 10) ; B : J7 immature (e7 = 0)
  select coalesce(sum(r1), 0), coalesce(sum(e7), 0), coalesce(sum(r7), 0), coalesce(sum(e14), 0)
    into v_rec from public.admin_retention();
  select sum(r1) as r1, sum(r7) as r7, sum(e7) as e7, sum(e14) as e14 into v_rec from public.admin_retention();
  if v_rec.r7 <> 1 or v_rec.e7 <> 1 or v_rec.e14 <> 0 then raise exception 'ÉCHEC 18 : rétention %', row_to_json(v_rec); end if;
  select count(*) into v_count from public.admin_retention() where e7 = 0 and signups > 0;
  if v_count < 1 then raise exception 'ÉCHEC 19 : cohorte immature absente'; end if;

  -- 20. Utilisation des fonctionnalités : check-in 2 personnes (A, B), plan 1 (A)
  select users into v_count from public.admin_feature_adoption('-infinity', now() + interval '1 minute') where feature = 'checkin';
  if v_count <> 2 then raise exception 'ÉCHEC 20 : adoption check-in %', v_count; end if;

  -- 21. Liste des comptes : pseudonymes, 3 comptes, aucun UUID ni courriel
  select count(*) into v_count from public.admin_users_page('all', 'recent', 25, 0, 7, 7, 14);
  select string_agg(row_to_json(p)::text, '') into v_text from public.admin_users_page('all', 'recent', 25, 0, 7, 7, 14) p;
  if v_count <> 3 or v_text ~ '[0-9a-f]{8}-[0-9a-f]{4}-' or v_text like '%@%' then raise exception 'ÉCHEC 21 : liste %', v_text; end if;
  select count(*) into v_count from public.admin_users_page('onboarding_incomplete', 'recent', 25, 0, 7, 7, 14);
  if v_count <> 1 then raise exception 'ÉCHEC 22 : filtre onboarding incomplet %', v_count; end if;

  -- 23. AUCUN texte privé dans les sorties des RPC (journal, lettre, contact, raison)
  v_code_a := upper(substr(md5(user_a::text), 1, 8));
  select concat_ws('|',
    (select string_agg(row_to_json(t)::text, '') from public.admin_overview('-infinity', now() + interval '1 minute') t),
    (select string_agg(row_to_json(t)::text, '') from public.admin_timeseries(now() - interval '30 days', now(), 'day') t),
    (select string_agg(row_to_json(t)::text, '') from public.admin_funnel('-infinity', now() + interval '1 minute') t),
    (select string_agg(row_to_json(t)::text, '') from public.admin_retention() t),
    (select string_agg(row_to_json(t)::text, '') from public.admin_feature_adoption('-infinity', now() + interval '1 minute') t),
    (select string_agg(row_to_json(t)::text, '') from public.admin_users_page('all', 'activity', 25, 0, 7, 7, 14) t),
    (select string_agg(row_to_json(t)::text, '') from public.admin_user_detail(v_code_a) t),
    (select string_agg(row_to_json(t)::text, '') from public.admin_feedback_page(null, null, 25, 0) t)
  ) into v_text;
  if position(secret in v_text) > 0 or position('514-555' in v_text) > 0 or v_text like '%example.invalid%' then
    raise exception 'ÉCHEC 23 : donnée privée exposée';
  end if;

  -- 24. Fiche produit de A : 4 check-ins, plan utilisé, aucune donnée du journal
  select * into v_rec from public.admin_user_detail(v_code_a);
  if v_rec.checkins <> 4 or not v_rec.used_plan or v_rec.used_ai then raise exception 'ÉCHEC 24 : fiche %', row_to_json(v_rec); end if;

  -- 25. Courriel révélé volontairement + journalisé
  if public.admin_reveal_account_email(v_code_a) <> 'adm-test-a@example.invalid' then raise exception 'ÉCHEC 25 : courriel'; end if;

  -- 26. Statut d'un avis par l'admin + journalisé ; avis de l'admin marqué « exclu »
  if not public.admin_set_feedback_status(v_feedback, 'reviewed') then raise exception 'ÉCHEC 26 : statut'; end if;
  perform set_config('role', 'postgres', true);
  select count(*) into v_count from public.admin_audit_log where admin_user_id = admin_c;
  if v_count <> 2 then raise exception 'ÉCHEC 26 : audit (%)', v_count; end if;
  perform set_config('role', 'authenticated', true);
  select count(*) into v_count from public.admin_feedback_page(null, null, 100, 0)
   where excluded and code = upper(substr(md5(admin_c::text), 1, 8));
  if v_count <> 1 then raise exception 'ÉCHEC 27 : avis admin non marqué'; end if;

  -- 28. Suppression du compte A : analytics sans erreur, total diminué, événements supprimés
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);
  perform public.delete_my_account();
  perform set_config('request.jwt.claims', json_build_object('sub', admin_c, 'role', 'authenticated')::text, true);
  select total_users into v_count from public.admin_overview('-infinity', now() + interval '1 minute');
  if v_count <> 2 then raise exception 'ÉCHEC 28 : total après suppression %', v_count; end if;
  perform set_config('role', 'postgres', true);
  select count(*) into v_count from public.product_events where user_id = user_a;
  if v_count <> 0 then raise exception 'ÉCHEC 28 : événements conservés'; end if;

  -- 29. Performance : 1 000 comptes fictifs, 10 check-ins chacun
  insert into auth.users (id, aud, role, email, created_at)
  select gen_random_uuid(), 'authenticated', 'authenticated', 'perf-' || g || '@example.invalid', now() - make_interval(days => g % 120)
    from generate_series(1, 1000) g;
  insert into public.daily_checkins (user_id, checkin_date, status, mood_score, energy_score, stress_score, craving_score, completed_at, updated_at)
  select u.id, v_today - d, 'sober', 5, 5, 5, 5, now() - make_interval(days => d), now() - make_interval(days => d)
    from auth.users u cross join generate_series(0, 9) d where u.email like 'perf-%@example.invalid';
  perform set_config('role', 'authenticated', true);
  v_t0 := clock_timestamp(); perform * from public.admin_overview(now() - interval '30 days', now());
  v_perf := v_perf || 'overview ' || round(extract(milliseconds from clock_timestamp() - v_t0)) || ' ms';
  v_t0 := clock_timestamp(); perform * from public.admin_timeseries(now() - interval '90 days', now(), 'week');
  v_perf := v_perf || ', séries ' || round(extract(milliseconds from clock_timestamp() - v_t0)) || ' ms';
  v_t0 := clock_timestamp(); perform * from public.admin_retention();
  v_perf := v_perf || ', rétention ' || round(extract(milliseconds from clock_timestamp() - v_t0)) || ' ms';
  v_t0 := clock_timestamp(); perform * from public.admin_users_page('all', 'activity', 25, 0, 7, 7, 14);
  v_perf := v_perf || ', liste ' || round(extract(milliseconds from clock_timestamp() - v_t0)) || ' ms';
  select total_users into v_count from public.admin_overview('-infinity', now() + interval '1 minute');
  if v_count <> 1002 then raise exception 'ÉCHEC 29 : % comptes', v_count; end if;

  -- 30. Suppression du compte admin : son rôle disparaît
  perform set_config('role', 'postgres', true);
  delete from auth.users where id = admin_c;
  select count(*) into v_count from public.admin_users where user_id = admin_c;
  if v_count <> 0 then raise exception 'ÉCHEC 30 : rôle admin conservé'; end if;

  raise exception 'RLS_OK — admin : 30 vérifications réussies (%) (transaction annulée volontairement)', v_perf;
end;
$$;
