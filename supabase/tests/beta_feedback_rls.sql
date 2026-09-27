-- =============================================================================
-- Vérification des avis bêta (Sprint 13) : insertion pour soi seulement, lecture de ses
-- propres avis, aucune modification ni suppression par le client, contraintes, limite
-- anti-envoi massif, suppression en cascade avec le compte.
--
-- Usage :
--   npx supabase db query --linked -f supabase/tests/beta_feedback_rls.sql
--
-- Un seul bloc atomique qui se termine TOUJOURS par une exception : toutes les
-- écritures (utilisateurs fictifs compris) sont annulées. Aucune donnée réelle.
--
-- Résultat attendu (affiché comme une erreur, c'est voulu) :
--   RLS_OK — beta_feedback : 10 vérifications réussies (transaction annulée volontairement)
-- =============================================================================

do $$
declare
  user_a constant uuid := '00000000-0000-4000-8000-0000000000ad';
  user_b constant uuid := '00000000-0000-4000-8000-0000000000bd';
  v_id uuid;
  v_count integer;
  v_error text;
begin
  insert into auth.users (id, aud, role, email, raw_user_meta_data) values
    (user_a, 'authenticated', 'authenticated', 'fb-test-a@example.invalid', '{"display_name":"A","timezone":"America/Toronto"}'),
    (user_b, 'authenticated', 'authenticated', 'fb-test-b@example.invalid', '{"display_name":"B","timezone":"America/Toronto"}');

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);

  -- 1. A envoie un avis pour lui-même
  insert into public.beta_feedback (user_id, category, message, page_context) values (user_a, 'bug', 'Avis fictif de A.', 'today')
  returning id into v_id;

  -- 2. A lit son avis
  select count(*) into v_count from public.beta_feedback where user_id = user_a;
  if v_count <> 1 then raise exception 'ÉCHEC 2 : lecture de son avis'; end if;

  -- 3. A ne peut pas envoyer au nom de B
  begin
    insert into public.beta_feedback (user_id, category, message) values (user_b, 'bug', 'Intrus.');
    raise exception 'ÉCHEC 3 : avis au nom de B';
  exception when insufficient_privilege then null;
  end;

  -- 4. Ni modification ni suppression par le client
  begin
    update public.beta_feedback set message = 'Modifié.' where id = v_id;
    raise exception 'ÉCHEC 4 : avis modifiable';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.beta_feedback where id = v_id;
    raise exception 'ÉCHEC 4 : avis supprimable';
  exception when insufficient_privilege then null;
  end;

  -- 5. Contraintes : catégorie, message vide ou trop long, section inconnue (jamais une URL)
  begin
    insert into public.beta_feedback (user_id, category, message) values (user_a, 'autre', 'Avis.');
    raise exception 'ÉCHEC 5 : catégorie inconnue acceptée';
  exception when check_violation then null;
  end;
  begin
    insert into public.beta_feedback (user_id, category, message) values (user_a, 'bug', '   ');
    raise exception 'ÉCHEC 5 : message vide accepté';
  exception when check_violation then null;
  end;
  begin
    insert into public.beta_feedback (user_id, category, message) values (user_a, 'bug', repeat('a', 2001));
    raise exception 'ÉCHEC 5 : message trop long accepté';
  exception when check_violation then null;
  end;
  begin
    insert into public.beta_feedback (user_id, category, message, page_context) values (user_a, 'bug', 'Avis.', '/journal/2026-09-27');
    raise exception 'ÉCHEC 5 : URL acceptée comme section';
  exception when check_violation then null;
  end;

  -- 6. Horodatage non modifiable à l'insertion
  begin
    insert into public.beta_feedback (user_id, category, message, created_at) values (user_a, 'bug', 'Avis.', now() - interval '2 days');
    raise exception 'ÉCHEC 6 : created_at choisi par le client';
  exception when insufficient_privilege then null;
  end;

  -- 7. Limite : 20 avis par 24 heures
  for i in 2..20 loop
    insert into public.beta_feedback (user_id, category, message) values (user_a, 'suggestion', 'Avis fictif ' || i);
  end loop;
  v_error := null;
  begin
    insert into public.beta_feedback (user_id, category, message) values (user_a, 'suggestion', 'Avis 21');
  exception when others then v_error := sqlerrm;
  end;
  if v_error is distinct from 'feedback_rate_limited' then raise exception 'ÉCHEC 7 : 21e avis (%)', v_error; end if;

  -- 8. B ne voit aucun avis de A
  perform set_config('request.jwt.claims', json_build_object('sub', user_b, 'role', 'authenticated')::text, true);
  select count(*) into v_count from public.beta_feedback where user_id = user_a;
  if v_count <> 0 then raise exception 'ÉCHEC 8 : B lit les avis de A'; end if;

  -- 9. anon n'a aucun accès
  if has_table_privilege('anon', 'public.beta_feedback', 'SELECT') or has_table_privilege('anon', 'public.beta_feedback', 'INSERT') then
    raise exception 'ÉCHEC 9 : accès anon';
  end if;

  -- 10. Suppression du compte : avis supprimés en cascade
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);
  perform public.delete_my_account();
  perform set_config('role', 'postgres', true);
  select count(*) into v_count from public.beta_feedback where user_id = user_a;
  if v_count <> 0 then raise exception 'ÉCHEC 10 : % avis restant(s)', v_count; end if;

  raise exception 'RLS_OK — beta_feedback : 10 vérifications réussies (transaction annulée volontairement)';
end;
$$;
