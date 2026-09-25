@AGENTS.md

# Mon Journal de Sobriété — instructions projet

Avant chaque sprint, lire dans cet ordre :

1. [docs/MASTER_PROMPT.md](docs/MASTER_PROMPT.md) — cahier des charges maître (fait autorité).
2. [docs/DECISIONS.md](docs/DECISIONS.md) — décisions d'architecture (ADR) déjà prises.
3. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) et [docs/DATABASE.md](docs/DATABASE.md).
4. [docs/PROJECT.md](docs/PROJECT.md) — roadmap et état des sprints.
5. [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) — configuration Supabase manuelle.

Règles essentielles :

- Implémenter **uniquement** le sprint demandé ; ne pas construire les fonctionnalités futures.
- npm uniquement. TypeScript strict, pas de `any`, pas de désactivation ESLint pour masquer un problème.
- Toute table de données utilisateur : migration versionnée + RLS dans la même migration.
- Jamais de `user_id` fourni par le client ; identité issue de la session côté serveur
  (`requireUser()` / `getCurrentUser()` dans chaque page, layout et Server Action protégés).
- Code par fonctionnalité dans `src/features/<domaine>/` (actions, schémas, composants).
- Onboarding obligatoire : routage via `src/lib/auth/redirects.ts` (proxy + layouts) ;
  `onboarding_completed` ne change que par la RPC `complete_onboarding` (ADR-028).
- Dates métier (`started_on`, futurs `local_date`) : type `date`, helpers de `src/lib/dates.ts`.
- Nouvelle table utilisateur : ajouter un test dans `supabase/tests/` (bloc atomique `RLS_OK`).
- Chemins via `src/config/routes.ts` ; redirections via `getSafeRedirect()`.
- Ne jamais journaliser courriel, mot de passe, jeton, cookie ni contenu personnel.
- Journée locale (`date`) séparée des timestamps UTC (ADR-006).
- Couleurs uniquement via les tokens de `src/app/globals.css` ; états = texte + icône + couleur.
- Textes d'interface en français, tutoiement, ton non culpabilisant.
- Avant de conclure : `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
- Mettre à jour `docs/` et proposer un commit (ne jamais `git push` sans autorisation).
