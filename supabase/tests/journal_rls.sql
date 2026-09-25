-- =============================================================================
-- Vérification du journal : search_journal() (filtres, recherche, pagination,
-- confidentialité) et accès aux données d'un autre utilisateur.
--
-- Usage : npx supabase db query --linked -f supabase/tests/journal_rls.sql
-- Bloc atomique toujours annulé (aucune donnée conservée).
-- Résultat attendu : RLS_OK — journal : 14 vérifications réussies
-- =============================================================================

do $$
declare
  user_a constant uuid := '00000000-0000-4000-8000-0000000000a3';
  user_b constant uuid := '00000000-0000-4000-8000-0000000000b3';
  v_today date := (now() at time zone 'America/Toronto')::date;
  v_count integer;
  v_first date;
begin
  insert into auth.users (id, aud, role, email, raw_user_meta_data) values
    (user_a, 'authenticated', 'authenticated', 'jrn-test-a@example.invalid', '{"timezone":"America/Toronto"}'),
    (user_b, 'authenticated', 'authenticated', 'jrn-test-b@example.invalid', '{"timezone":"America/Toronto"}');

  -- Données fictives de A (administrateur) : 25 journées terminées + 1 brouillon
  insert into public.daily_checkins
    (user_id, checkin_date, status, mood_score, energy_score, stress_score, craving_score, victory_text, notes, completed_at)
  select user_a, v_today - n,
         case when n % 5 = 0 then 'consumed' when n % 3 = 0 then 'sober_with_craving' else 'sober' end::public.checkin_status,
         6, 6, 5, 4,
         case n
           when 1 then 'J''ai pris une marche après le travail.'
           when 2 then 'Journée de travail tranquille.'
           when 10 then 'Réunion de travail difficile, mais tenu bon.'
           when 4 then 'Remboursé 100% de ma dette.'
         end,
         case when n = 3 then 'Note privée sur le travail.' end,
         now()
    from generate_series(1, 25) as n;
  insert into public.daily_checkins (user_id, checkin_date, status, victory_text)
  values (user_a, v_today, 'sober', 'Brouillon qui parle de marche.');

  -- Une journée de B contenant le même mot
  insert into public.daily_checkins
    (user_id, checkin_date, status, mood_score, energy_score, stress_score, craving_score, victory_text, completed_at)
  values (user_b, v_today - 1, 'sober', 5, 5, 5, 5, 'Une marche secrète de B.', now());

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);

  -- 1. Première page : 21 lignes demandées (20 + 1 pour « Afficher plus »), plus récente d'abord
  select count(*), max(checkin_date) into v_count, v_first from public.search_journal(p_limit => 21);
  if v_count <> 21 or v_first <> v_today - 1 then raise exception 'ÉCHEC 1 : % lignes, première %', v_count, v_first; end if;

  -- 2. Les brouillons ne figurent jamais dans le journal
  select count(*) into v_count from public.search_journal(p_limit => 51) where checkin_date = v_today;
  if v_count <> 0 then raise exception 'ÉCHEC 2 : brouillon affiché'; end if;

  -- 3. Page suivante via le curseur (borne exclusive)
  select count(*) into v_count from public.search_journal(p_before => v_today - 20, p_limit => 21);
  if v_count <> 5 then raise exception 'ÉCHEC 3 : % lignes après le curseur', v_count; end if;

  -- 4. Recherche « marche » → 1 résultat (le brouillon et la journée de B sont exclus)
  select count(*) into v_count from public.search_journal(p_query => 'marche');
  if v_count <> 1 then raise exception 'ÉCHEC 4 : % résultats pour marche', v_count; end if;

  -- 5. Recherche insensible à la casse
  select count(*) into v_count from public.search_journal(p_query => 'MARCHE');
  if v_count <> 1 then raise exception 'ÉCHEC 5 : casse'; end if;

  -- 6. Recherche « vacances » → aucun résultat
  select count(*) into v_count from public.search_journal(p_query => 'vacances');
  if v_count <> 0 then raise exception 'ÉCHEC 6 : vacances'; end if;

  -- 7. Recherche dans les notes aussi (« travail » : jours 2, 3, 10)
  select count(*) into v_count from public.search_journal(p_query => 'travail');
  if v_count <> 4 then raise exception 'ÉCHEC 7 : % résultats pour travail', v_count; end if;

  -- 8. Recherche + statut : « travail » ET sober → jours 1 et 2 seulement
  select count(*) into v_count from public.search_journal(p_status => 'sober', p_query => 'travail');
  if v_count <> 2 then raise exception 'ÉCHEC 8 : % résultats travail + sober', v_count; end if;

  -- 9. Recherche + statut + période (7 derniers jours : jours 1 à 6)
  select count(*) into v_count from public.search_journal(p_status => 'sober', p_from => v_today - 6, p_query => 'travail');
  if v_count <> 2 then raise exception 'ÉCHEC 9 : % résultats', v_count; end if;
  select count(*) into v_count from public.search_journal(p_status => 'consumed', p_from => v_today - 6, p_query => 'travail');
  if v_count <> 0 then raise exception 'ÉCHEC 9 : consommation'; end if;

  -- 10. Filtres de statut
  select count(*) into v_count from public.search_journal(p_status => 'consumed', p_limit => 51);
  if v_count <> 5 then raise exception 'ÉCHEC 10 : % consommations', v_count; end if;
  select count(*) into v_count from public.search_journal(p_status => 'sober_with_craving', p_limit => 51);
  if v_count <> 7 then raise exception 'ÉCHEC 10 : % forte envie', v_count; end if;

  -- 11. « % » et « _ » sont recherchés littéralement (pas de joker injecté)
  select count(*) into v_count from public.search_journal(p_query => '100%');
  if v_count <> 1 then raise exception 'ÉCHEC 11 : %% littéral'; end if;
  select count(*) into v_count from public.search_journal(p_query => '%', p_limit => 51);
  if v_count <> 1 then raise exception 'ÉCHEC 11 : %% seul = % résultats (joker ?)', v_count; end if;

  -- 12. Taille de page bornée à 51
  select count(*) into v_count from public.search_journal(p_limit => 1000);
  if v_count <> 25 then raise exception 'ÉCHEC 12 : % lignes', v_count; end if;

  -- Contexte : utilisateur B -------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', user_b, 'role', 'authenticated')::text, true);

  -- 13. B ne trouve que sa propre journée, jamais celles de A (même en cherchant « travail »)
  select count(*) into v_count from public.search_journal(p_limit => 51);
  if v_count <> 1 then raise exception 'ÉCHEC 13 : B voit % journées', v_count; end if;
  select count(*) into v_count from public.search_journal(p_query => 'travail');
  if v_count <> 0 then raise exception 'ÉCHEC 13 : B trouve les textes de A'; end if;

  -- 14. B ne lit pas une date existante de A (détail / calendrier)
  select count(*) into v_count from public.daily_checkins where checkin_date = v_today - 2;
  if v_count <> 0 then raise exception 'ÉCHEC 14 : B lit la journée de A'; end if;

  raise exception 'RLS_OK — journal : 14 vérifications réussies (transaction annulée volontairement)';
end;
$$;
