-- =============================================================================
-- Vérification des bilans intelligents (Sprint 12) : consentement obligatoire, un bilan
-- par période glissante de 24 heures, date de génération non modifiable, écriture uniquement par RPC,
-- remplacement d'une période, libération d'un essai (jeton serveur), désactivation, isolation A/B et suppression en cascade.
--
-- Usage :
--   npx supabase db query --linked -f supabase/tests/ai_rls.sql
--
-- Un seul bloc atomique qui se termine TOUJOURS par une exception : toutes les
-- écritures (utilisateurs fictifs compris) sont annulées. Aucune donnée réelle.
--
-- Résultat attendu (affiché comme une erreur, c'est voulu) :
--   RLS_OK — ai : 24 vérifications réussies (transaction annulée volontairement)
-- =============================================================================

do $$
declare
  user_a constant uuid := '00000000-0000-4000-8000-0000000000ac';
  user_b constant uuid := '00000000-0000-4000-8000-0000000000bc';
  v_today date := (now() at time zone 'UTC')::date;
  v_content constant jsonb := '{"summary":"Bilan fictif de la semaine."}'::jsonb;
  v_error text;
  v_count integer;
  v_remaining integer;
  v_id uuid;
  v_id2 uuid;
  v_summary text;
  v_token uuid;
  v_ok boolean;
begin
  insert into auth.users (id, aud, role, email, raw_user_meta_data) values
    (user_a, 'authenticated', 'authenticated', 'ai-test-a@example.invalid', '{"display_name":"A","timezone":"America/Toronto"}'),
    (user_b, 'authenticated', 'authenticated', 'ai-test-b@example.invalid', '{"display_name":"B","timezone":"America/Toronto"}');

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);

  -- 1. Par défaut (aucune préférence) : réservation refusée
  v_error := null;
  begin perform public.reserve_ai_generation(); exception when others then v_error := sqlerrm; end;
  if v_error is distinct from 'ai_consent_required' then raise exception 'ÉCHEC 1 : réservation sans consentement (%)', v_error; end if;

  -- 2. Enregistrement d'un bilan sans consentement : refusé
  v_error := null;
  begin
    perform public.save_ai_reflection(v_today - 6, v_today, 'Bilan fictif.', v_content, 'test', 'modele-fictif', 'weekly-reflection-v1');
  exception when others then v_error := sqlerrm;
  end;
  if v_error is distinct from 'ai_consent_required' then raise exception 'ÉCHEC 2 : bilan sans consentement (%)', v_error; end if;

  -- 3. Activation sans consentement horodaté : refusée par la contrainte
  begin
    insert into public.ai_preferences (user_id, ai_enabled) values (user_a, true);
    raise exception 'ÉCHEC 3 : activation sans consentement';
  exception when check_violation then null;
  end;

  -- 4. Préférences désactivées (ligne existante) : réservation toujours refusée
  insert into public.ai_preferences (user_id, ai_enabled) values (user_a, false);
  v_error := null;
  begin perform public.reserve_ai_generation(); exception when others then v_error := sqlerrm; end;
  if v_error is distinct from 'ai_consent_required' then raise exception 'ÉCHEC 4 : réservation IA désactivée (%)', v_error; end if;

  -- 5. Date de dernière génération : jamais modifiable par le client
  begin
    update public.ai_preferences set last_generation_at = null where user_id = user_a;
    raise exception 'ÉCHEC 5 : date de génération modifiable';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.ai_preferences (user_id, last_generation_at) values (user_b, null);
    raise exception 'ÉCHEC 5 : date de génération insérable';
  exception when insufficient_privilege then null;
  end;

  -- 6. Activation avec consentement : une réservation, la 2e dans les 24 h est refusée
  update public.ai_preferences set ai_enabled = true, consented_at = now(), consent_version = '1' where user_id = user_a;
  select remaining into v_remaining from public.reserve_ai_generation();
  if v_remaining <> 0 then raise exception 'ÉCHEC 6 : % restante(s)', v_remaining; end if;
  v_error := null;
  begin perform public.reserve_ai_generation(); exception when others then v_error := sqlerrm; end;
  if v_error is distinct from 'ai_rate_limited' then raise exception 'ÉCHEC 7 : 2e génération dans les 24 h (%)', v_error; end if;

  -- 8. Fenêtre glissante : refus après 23 h, accepté après 25 h (simulé côté propriétaire)
  perform set_config('role', 'postgres', true);
  update public.ai_preferences set last_generation_at = now() - interval '23 hours' where user_id = user_a;
  perform set_config('role', 'authenticated', true);
  v_error := null;
  begin perform public.reserve_ai_generation(); exception when others then v_error := sqlerrm; end;
  if v_error is distinct from 'ai_rate_limited' then raise exception 'ÉCHEC 8 : accepté après 23 h (%)', v_error; end if;
  perform set_config('role', 'postgres', true);
  update public.ai_preferences set last_generation_at = now() - interval '25 hours' where user_id = user_a;
  perform set_config('role', 'authenticated', true);
  select remaining, reservation into v_remaining, v_token from public.reserve_ai_generation();

  -- 21. Libération avec un mauvais jeton : refusée, fenêtre inchangée
  if public.release_ai_generation(gen_random_uuid()) then raise exception 'ÉCHEC 21 : libération sans le bon jeton'; end if;
  select count(*) into v_count from public.ai_preferences where user_id = user_a and last_generation_at > now() - interval '1 minute';
  if v_count <> 1 then raise exception 'ÉCHEC 21 : fenêtre modifiée'; end if;

  -- 22. Libération avec le jeton : la date précédente est restaurée, une seule fois
  v_ok := public.release_ai_generation(v_token);
  select count(*) into v_count from public.ai_preferences
   where user_id = user_a and last_generation_at between now() - interval '26 hours' and now() - interval '24 hours';
  if not v_ok or v_count <> 1 then raise exception 'ÉCHEC 22 : libération (% / %)', v_ok, v_count; end if;
  if public.release_ai_generation(v_token) then raise exception 'ÉCHEC 22 : double libération'; end if;

  -- 23. Les jetons de réservation ne sont lisibles par aucun client
  begin
    perform 1 from public.ai_generation_reservations;
    raise exception 'ÉCHEC 23 : réservations lisibles';
  exception when insufficient_privilege then null;
  end;
  perform public.reserve_ai_generation();

  -- 9. Écriture directe dans ai_reflections : refusée (RPC uniquement)
  begin
    insert into public.ai_reflections (user_id, period_start, period_end, summary, content, prompt_version)
    values (user_a, v_today - 6, v_today, 'Intrus.', v_content, 'x');
    raise exception 'ÉCHEC 9 : insertion directe';
  exception when insufficient_privilege then null;
  end;

  -- 10. Enregistrement par RPC puis régénération de la même période : REMPLACE
  v_id := public.save_ai_reflection(v_today - 6, v_today, 'Premier bilan fictif.', v_content, 'test', 'modele-fictif', 'weekly-reflection-v1');
  v_id2 := public.save_ai_reflection(v_today - 6, v_today, 'Bilan fictif régénéré.', v_content, 'test', 'modele-fictif', 'weekly-reflection-v1');
  select count(*), max(summary) into v_count, v_summary from public.ai_reflections where user_id = user_a;
  if v_id <> v_id2 or v_count <> 1 or v_summary <> 'Bilan fictif régénéré.' then raise exception 'ÉCHEC 10 : régénération (% bilans)', v_count; end if;

  -- 11. Modification directe d'un bilan : refusée
  begin
    update public.ai_reflections set summary = 'Modifié.' where id = v_id;
    raise exception 'ÉCHEC 11 : bilan modifiable';
  exception when insufficient_privilege then null;
  end;

  -- 12. Contraintes de forme : résumé trop long, contenu non objet
  begin
    perform public.save_ai_reflection(v_today - 13, v_today - 7, repeat('a', 1300), v_content, 'test', 'modele-fictif', 'weekly-reflection-v1');
    raise exception 'ÉCHEC 12 : résumé trop long accepté';
  exception when check_violation then null;
  end;
  begin
    perform public.save_ai_reflection(v_today - 13, v_today - 7, 'Bilan fictif.', '[]'::jsonb, 'test', 'modele-fictif', 'weekly-reflection-v1');
    raise exception 'ÉCHEC 12 : contenu non objet accepté';
  exception when check_violation then null;
  end;

  -- Contexte : B ------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', user_b, 'role', 'authenticated')::text, true);

  -- 13. B ne lit ni les préférences ni les bilans de A
  select count(*) into v_count from public.ai_preferences where user_id = user_a;
  if v_count <> 0 then raise exception 'ÉCHEC 13 : B lit les préférences de A'; end if;
  select count(*) into v_count from public.ai_reflections where user_id = user_a;
  if v_count <> 0 then raise exception 'ÉCHEC 13 : B lit les bilans de A'; end if;

  -- 14. B ne modifie ni ne supprime rien chez A
  update public.ai_preferences set ai_enabled = false where user_id = user_a;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'ÉCHEC 14 : B désactive A'; end if;
  delete from public.ai_reflections where id = v_id;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'ÉCHEC 14 : B supprime le bilan de A'; end if;

  -- 15. B ne crée pas de préférences au nom de A
  begin
    insert into public.ai_preferences (user_id, ai_enabled) values (user_a, false);
    raise exception 'ÉCHEC 15 : préférences créées au nom de A';
  exception when insufficient_privilege or unique_violation then null;
  end;

  -- 16. Les RPC n'agissent que pour l'utilisateur courant : B (sans consentement) refusé
  v_error := null;
  begin perform public.reserve_ai_generation(); exception when others then v_error := sqlerrm; end;
  if v_error is distinct from 'ai_consent_required' then raise exception 'ÉCHEC 16 : réservation de B (%)', v_error; end if;

  -- 17. anon ne peut exécuter aucune RPC IA
  if has_function_privilege('anon', 'public.reserve_ai_generation()', 'EXECUTE')
     or has_function_privilege('anon', 'public.save_ai_reflection(date, date, text, jsonb, text, text, text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.release_ai_generation(uuid)', 'EXECUTE') then
    raise exception 'ÉCHEC 17 : RPC IA exécutable par anon';
  end if;

  -- Contexte : A ------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);

  -- 18. Désactivation : les bilans sont conservés, toute nouvelle génération est refusée
  update public.ai_preferences set ai_enabled = false, revoked_at = now() where user_id = user_a;
  select count(*) into v_count from public.ai_reflections where user_id = user_a;
  if v_count <> 1 then raise exception 'ÉCHEC 18 : bilans perdus à la désactivation'; end if;
  v_error := null;
  begin
    perform public.save_ai_reflection(v_today - 13, v_today - 7, 'Bilan fictif.', v_content, 'test', 'modele-fictif', 'weekly-reflection-v1');
  exception when others then v_error := sqlerrm;
  end;
  if v_error is distinct from 'ai_consent_required' then raise exception 'ÉCHEC 18 : bilan après désactivation (%)', v_error; end if;

  -- 19. A supprime son propre bilan
  delete from public.ai_reflections where id = v_id;
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'ÉCHEC 19 : suppression de son bilan'; end if;

  -- 20 et 24. Suppression du compte : préférences, bilans et réservations supprimés en cascade
  update public.ai_preferences set ai_enabled = true, consented_at = now(), consent_version = '1' where user_id = user_a;
  perform public.save_ai_reflection(v_today - 6, v_today, 'Bilan fictif.', v_content, 'test', 'modele-fictif', 'weekly-reflection-v1');
  perform public.delete_my_account();
  perform set_config('role', 'postgres', true);
  select (select count(*) from public.ai_preferences where user_id = user_a) + (select count(*) from public.ai_reflections where user_id = user_a)
       + (select count(*) from public.ai_generation_reservations where user_id = user_a)
    into v_count;
  if v_count <> 0 then raise exception 'ÉCHEC 20 : % ligne(s) IA restante(s) après suppression du compte', v_count; end if;

  raise exception 'RLS_OK — ai : 24 vérifications réussies (transaction annulée volontairement)';
end;
$$;
