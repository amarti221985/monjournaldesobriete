-- =============================================================================
-- Vérification de la table profiles : trigger de création, updated_at, RLS,
-- privilèges.
--
-- Usage :
--   - Supabase Dashboard > SQL Editor : coller le contenu, puis Run;
--   - ou en ligne de commande : npx supabase db query --linked -f supabase/tests/profiles_rls.sql
--
-- Le script est UN SEUL bloc atomique qui se termine TOUJOURS par une exception :
-- toutes ses écritures sont annulées, quel que soit l'outil d'exécution.
-- Aucune donnée ne reste en base. Les utilisateurs sont fictifs.
--
-- Résultat attendu (affiché comme une erreur, c'est voulu) :
--   RLS_OK — profiles : 14 vérifications réussies (transaction annulée volontairement)
-- Toute autre erreur « ÉCHEC : ... » indique un problème de sécurité ou de schéma.
-- =============================================================================

do $$
declare
  user_a constant uuid := '00000000-0000-4000-8000-00000000000a';
  user_b constant uuid := '00000000-0000-4000-8000-00000000000b';
  v_count integer;
  v_profile public.profiles%rowtype;
begin
  -- Deux utilisateurs fictifs (le trigger on_auth_user_created crée leurs profils)
  insert into auth.users (id, aud, role, email, raw_user_meta_data)
  values
    (user_a, 'authenticated', 'authenticated', 'rls-test-a@example.invalid',
     '{"display_name": "  Test   A ", "timezone": "America/Toronto"}'),
    (user_b, 'authenticated', 'authenticated', 'rls-test-b@example.invalid',
     '{"display_name": "x", "timezone": "UTC-4"}');

  -- 1-3. Trigger de création et nettoyage des métadonnées ---------------------
  select * into v_profile from public.profiles where id = user_a;
  if not found then
    raise exception 'ÉCHEC : le profil A n''a pas été créé par le trigger';
  end if;
  if v_profile.display_name is distinct from 'Test A' then
    raise exception 'ÉCHEC : display_name A mal nettoyé (%)', v_profile.display_name;
  end if;
  if v_profile.timezone is distinct from 'America/Toronto' then
    raise exception 'ÉCHEC : timezone A non enregistrée';
  end if;

  -- 4. Valeurs invalides ignorées sans bloquer l'inscription -------------------
  select * into v_profile from public.profiles where id = user_b;
  if not found or v_profile.display_name is not null or v_profile.timezone is not null then
    raise exception 'ÉCHEC : les métadonnées invalides de B auraient dû devenir NULL';
  end if;

  -- Contexte : utilisateur A authentifié --------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', user_a, 'role', 'authenticated')::text,
    true
  );

  -- 5. A ne voit que son propre profil -----------------------------------------
  select count(*) into v_count from public.profiles;
  if v_count <> 1 then
    raise exception 'ÉCHEC : A voit % profils au lieu de 1', v_count;
  end if;

  -- 6. A ne peut pas lire le profil de B ---------------------------------------
  select count(*) into v_count from public.profiles where id = user_b;
  if v_count <> 0 then
    raise exception 'ÉCHEC : A peut lire le profil de B';
  end if;

  -- 7. A ne peut pas modifier le profil de B -----------------------------------
  update public.profiles set display_name = 'Pirate' where id = user_b;
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'ÉCHEC : A a modifié le profil de B';
  end if;

  -- 8-9. A peut modifier son profil ; updated_at est mis à jour par la base ----
  update public.profiles set timezone = 'Europe/Paris' where id = user_a;
  get diagnostics v_count = row_count;
  if v_count <> 1 then
    raise exception 'ÉCHEC : A ne peut pas modifier son propre profil';
  end if;
  select * into v_profile from public.profiles where id = user_a;
  if v_profile.updated_at <= v_profile.created_at then
    raise exception 'ÉCHEC : updated_at n''a pas été mis à jour par le trigger';
  end if;

  -- 10. A ne peut pas se réattribuer le profil d'un autre (colonne id) ---------
  begin
    update public.profiles set id = user_b where id = user_a;
    raise exception 'ÉCHEC : A peut modifier la colonne id';
  exception when insufficient_privilege then null;
  end;

  -- 11. Colonnes techniques non modifiables -----------------------------------
  begin
    update public.profiles set created_at = now() where id = user_a;
    raise exception 'ÉCHEC : A peut modifier created_at';
  exception when insufficient_privilege then null;
  end;

  -- 12. Pas d'INSERT direct (le profil est créé par le trigger) -----------------
  begin
    insert into public.profiles (id) values (gen_random_uuid());
    raise exception 'ÉCHEC : A peut insérer un profil';
  exception when insufficient_privilege then null;
  end;

  -- 13. Pas de DELETE direct ----------------------------------------------------
  begin
    delete from public.profiles where id = user_a;
    raise exception 'ÉCHEC : A peut supprimer un profil';
  exception when insufficient_privilege then null;
  end;

  -- 14. Visiteur anonyme : aucun accès -----------------------------------------
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  begin
    perform 1 from public.profiles;
    raise exception 'ÉCHEC : un visiteur anonyme peut lire profiles';
  exception when insufficient_privilege then null;
  end;

  -- Annule toutes les écritures du bloc (utilisateurs fictifs compris).
  raise exception 'RLS_OK — profiles : 14 vérifications réussies (transaction annulée volontairement)';
end;
$$;
