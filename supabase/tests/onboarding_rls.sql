-- =============================================================================
-- Vérification de l'onboarding : catalogue, RLS des données du parcours,
-- finalisation atomique et idempotente, garde-fou onboarding_completed.
--
-- Usage :
--   npx supabase db query --linked -f supabase/tests/onboarding_rls.sql
--   (ou Supabase Dashboard > SQL Editor)
--
-- Un seul bloc atomique qui se termine TOUJOURS par une exception : toutes les
-- écritures (utilisateurs fictifs compris) sont annulées. Aucune donnée ne reste.
--
-- Résultat attendu (affiché comme une erreur, c'est voulu) :
--   RLS_OK — onboarding : 24 vérifications réussies (transaction annulée volontairement)
-- =============================================================================

do $$
declare
  user_a constant uuid := '00000000-0000-4000-8000-0000000000a1';
  user_b constant uuid := '00000000-0000-4000-8000-0000000000b1';
  user_c constant uuid := '00000000-0000-4000-8000-0000000000c1';
  v_count integer;
  v_result text;
  v_error text;
  v_valid_payload jsonb := jsonb_build_object(
    'substances', jsonb_build_array(
      jsonb_build_object('slug', 'cannabis', 'goal', 'abstinence'),
      jsonb_build_object('slug', 'nicotine', 'goal', 'reduction'),
      jsonb_build_object('slug', 'other', 'goal', 'observation', 'customName', 'Jeux')
    ),
    'primarySlug', 'cannabis',
    'startedOn', '2026-09-01',
    'reason', 'Retrouver mon énergie.',
    'motivations', jsonb_build_array('health', 'freedom', 'other'),
    'motivationOther', 'Voyager',
    'supportContact', jsonb_build_object('name', 'Julie', 'relationship', 'Amie', 'email', 'Julie@Example.com')
  );
begin
  insert into auth.users (id, aud, role, email, raw_user_meta_data)
  values
    (user_a, 'authenticated', 'authenticated', 'onb-test-a@example.invalid', '{"display_name":"A","timezone":"America/Toronto"}'),
    (user_b, 'authenticated', 'authenticated', 'onb-test-b@example.invalid', '{"display_name":"B","timezone":"America/Toronto"}'),
    (user_c, 'authenticated', 'authenticated', 'onb-test-c@example.invalid', '{"display_name":"C"}');

  -- 1. Garde-fou en base : impossible de terminer sans données, même en administrateur
  v_error := null;
  begin
    update public.profiles set onboarding_completed = true where id = user_c;
  exception when others then v_error := sqlerrm;
  end;
  if v_error is distinct from 'onboarding_incomplete' then
    raise exception 'ÉCHEC 1 : le garde-fou n''a pas bloqué un onboarding vide (%)', v_error;
  end if;

  -- Contexte : utilisateur A -------------------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);

  -- 2. Catalogue lisible (6 entrées actives)
  select count(*) into v_count from public.substances;
  if v_count <> 6 then raise exception 'ÉCHEC 2 : catalogue (% lignes)', v_count; end if;

  -- 3-5. Catalogue non modifiable
  begin
    insert into public.substances (slug, name_fr, sort_order) values ('pirate', 'Pirate', 99);
    raise exception 'ÉCHEC 3 : insertion dans le catalogue autorisée';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.substances set name_fr = 'Pirate';
    raise exception 'ÉCHEC 4 : modification du catalogue autorisée';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.substances;
    raise exception 'ÉCHEC 5 : suppression dans le catalogue autorisée';
  exception when insufficient_privilege then null;
  end;

  -- 6. onboarding_completed non modifiable directement (correction Sprint 1)
  begin
    update public.profiles set onboarding_completed = true where id = user_a;
    raise exception 'ÉCHEC 6 : onboarding_completed modifiable directement';
  exception when insufficient_privilege then null;
  end;

  -- 7. Brouillon : A peut enregistrer le sien
  insert into public.onboarding_drafts (user_id, current_step, data) values (user_a, 3, '{"reason":"brouillon"}');

  -- 8. Finalisation réussie (plusieurs substances, objectifs différents)
  v_result := public.complete_onboarding(v_valid_payload);
  if v_result <> 'completed' then raise exception 'ÉCHEC 8 : finalisation (%)', v_result; end if;

  -- 9. Données créées : 3 substances, 1 principale, raison, 3 motivations, contact
  select count(*) into v_count from public.user_substances where user_id = user_a;
  if v_count <> 3 then raise exception 'ÉCHEC 9 : % substances', v_count; end if;
  select count(*) into v_count from public.user_substances where user_id = user_a and is_primary;
  if v_count <> 1 then raise exception 'ÉCHEC 9 : % principales', v_count; end if;
  select count(*) into v_count from public.user_motivations where user_id = user_a;
  if v_count <> 3 then raise exception 'ÉCHEC 9 : % motivations', v_count; end if;
  select count(*) into v_count from public.support_contacts where user_id = user_a and email = 'julie@example.com';
  if v_count <> 1 then raise exception 'ÉCHEC 9 : contact absent ou non normalisé'; end if;

  -- 10. Profil terminé et brouillon supprimé
  select count(*) into v_count from public.profiles where id = user_a and onboarding_completed;
  if v_count <> 1 then raise exception 'ÉCHEC 10 : profil non terminé'; end if;
  select count(*) into v_count from public.onboarding_drafts where user_id = user_a;
  if v_count <> 0 then raise exception 'ÉCHEC 10 : brouillon non supprimé'; end if;

  -- 11. Idempotence : une seconde soumission ne crée rien
  v_result := public.complete_onboarding(v_valid_payload);
  select count(*) into v_count from public.user_substances where user_id = user_a;
  if v_result <> 'already_completed' or v_count <> 3 then
    raise exception 'ÉCHEC 11 : double soumission (% / % substances)', v_result, v_count;
  end if;

  -- Contexte : utilisateur B -------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', user_b, 'role', 'authenticated')::text, true);

  -- 12-15. B ne voit aucune donnée de A
  select count(*) into v_count from public.user_substances;
  if v_count <> 0 then raise exception 'ÉCHEC 12 : B voit des substances de A'; end if;
  select count(*) into v_count from public.personal_reasons;
  if v_count <> 0 then raise exception 'ÉCHEC 13 : B voit la raison de A'; end if;
  select count(*) into v_count from public.user_motivations;
  if v_count <> 0 then raise exception 'ÉCHEC 14 : B voit les motivations de A'; end if;
  select count(*) into v_count from public.support_contacts;
  if v_count <> 0 then raise exception 'ÉCHEC 15 : B voit les contacts de A'; end if;

  -- 16. B ne peut ni modifier ni supprimer les données de A
  update public.support_contacts set name = 'Pirate' where user_id = user_a;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'ÉCHEC 16 : B a modifié un contact de A'; end if;
  delete from public.user_substances where user_id = user_a;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'ÉCHEC 16 : B a supprimé une substance de A'; end if;

  -- 17. B ne peut pas créer de ligne au nom de A
  begin
    insert into public.support_contacts (user_id, name) values (user_a, 'Pirate');
    raise exception 'ÉCHEC 17 : B a créé un contact pour A';
  exception when insufficient_privilege then null;
  end;

  -- 18-22. Finalisation refusée si incomplète, sans rien enregistrer (atomique)
  foreach v_result in array array['substances', 'reason', 'motivations', 'startedOn', 'primarySlug'] loop
    v_error := null;
    begin
      perform public.complete_onboarding(
        case v_result
          when 'substances' then jsonb_set(v_valid_payload, '{substances}', '[]'::jsonb)
          when 'reason' then jsonb_set(v_valid_payload, '{reason}', '"   "'::jsonb)
          when 'motivations' then jsonb_set(v_valid_payload, '{motivations}', '[]'::jsonb)
          -- date future : lendemain dans le fuseau du profil
          when 'startedOn' then jsonb_set(v_valid_payload, '{startedOn}',
            to_jsonb(((now() at time zone 'America/Toronto')::date + 1)::text))
          else jsonb_set(v_valid_payload, '{primarySlug}', '"alcohol"'::jsonb)
        end
      );
    exception when others then v_error := sqlerrm;
    end;
    if v_error is null then
      raise exception 'ÉCHEC 18-22 : finalisation acceptée sans %', v_result;
    end if;
  end loop;

  select count(*) into v_count from public.user_substances;
  if v_count <> 0 then raise exception 'ÉCHEC 23 : données partielles enregistrées pour B'; end if;
  select count(*) into v_count from public.profiles where id = user_b and onboarding_completed;
  if v_count <> 0 then raise exception 'ÉCHEC 23 : B marqué terminé malgré les refus'; end if;

  -- 24. Anonyme : aucun accès au catalogue ni aux données
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin
    perform 1 from public.substances;
    raise exception 'ÉCHEC 24 : un visiteur anonyme lit le catalogue';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.complete_onboarding(v_valid_payload);
    raise exception 'ÉCHEC 24 : un visiteur anonyme peut appeler la finalisation';
  exception when insufficient_privilege then null;
  end;

  raise exception 'RLS_OK — onboarding : 24 vérifications réussies (transaction annulée volontairement)';
end;
$$;
