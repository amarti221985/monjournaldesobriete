-- =============================================================================
-- Sprint 2 — correctif : sauvegarde du brouillon par « upsert »
--
-- L'upsert de PostgREST (INSERT ... ON CONFLICT DO UPDATE) réécrit toutes les
-- colonnes fournies, y compris la clé user_id. Sans privilège UPDATE sur cette
-- colonne, la sauvegarde automatique du brouillon échouait (42501).
--
-- Sans risque : la politique onboarding_drafts_update_own impose
-- (select auth.uid()) = user_id en USING et en WITH CHECK ; un utilisateur ne peut
-- donc « réécrire » user_id qu'avec sa propre valeur.
-- =============================================================================

grant update (user_id) on table public.onboarding_drafts to authenticated;
