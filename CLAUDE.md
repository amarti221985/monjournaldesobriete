@AGENTS.md

# Mon Journal de Sobriété — instructions projet

Avant chaque sprint, lire dans cet ordre :

1. [docs/MASTER_PROMPT.md](docs/MASTER_PROMPT.md) — cahier des charges maître (fait autorité).
2. [docs/DECISIONS.md](docs/DECISIONS.md) — décisions d'architecture (ADR) déjà prises.
3. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) et [docs/DATABASE.md](docs/DATABASE.md).
4. [docs/PROJECT.md](docs/PROJECT.md) — roadmap et état des sprints.

Règles essentielles :

- Implémenter **uniquement** le sprint demandé ; ne pas construire les fonctionnalités futures.
- npm uniquement. TypeScript strict, pas de `any`, pas de désactivation ESLint pour masquer un problème.
- Toute table de données utilisateur : migration versionnée + RLS dans la même migration.
- Jamais de `user_id` fourni par le client ; identité issue de la session côté serveur.
- Journée locale (`date`) séparée des timestamps UTC (ADR-006).
- Couleurs uniquement via les tokens de `src/app/globals.css` ; états = texte + icône + couleur.
- Textes d'interface en français, tutoiement, ton non culpabilisant.
- Avant de conclure : `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
- Mettre à jour `docs/` et proposer un commit (ne jamais `git push` sans autorisation).
