@AGENTS.md

# Mon Journal de Sobriété — instructions projet

Avant chaque sprint, lire dans cet ordre :

1. [docs/MASTER_PROMPT.md](docs/MASTER_PROMPT.md) — cahier des charges maître (fait autorité).
2. [docs/DECISIONS.md](docs/DECISIONS.md) — décisions d'architecture (ADR) déjà prises.
3. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) et [docs/DATABASE.md](docs/DATABASE.md).
4. [docs/PROJECT.md](docs/PROJECT.md) — roadmap et état des sprints.
   [docs/SECURITY.md](docs/SECURITY.md) et [docs/PRIVACY.md](docs/PRIVACY.md) — sécurité et données.
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
- « Aujourd'hui » = `getUserToday(profiles.timezone)`, jamais la date UTC. Écritures du check-in
  uniquement via la RPC `save_checkin` ; seuls les check-ins terminés (`completed_at`) comptent.
- Données sensibles (check-in, journal) : jamais dans les URL, les journaux ni un outil d'analytique.
- Statistiques : fonctions pures de `src/features/progress/` (jamais dans le JSX), check-ins
  terminés seulement ; journée sans check-in = inconnue (ADR-042) ; aucun agrégat persisté.
- Tendances : uniquement via `insights.ts` (seuils + modèles), descriptives, jamais causales ni médicales.
- États de journée : toujours via `getDayStateDisplay()` (`src/config/day-status.ts`), jamais un mapping local.
- Périodes : journées calendaires locales (`src/features/progress/periods.ts`), jamais « N derniers
  check-ins » ni `Date.now() - N × 24 h`. Analyses : seuils de `ANALYTICS_THRESHOLDS` /
  `PROGRESS_INSIGHT_RULES`, écarts en points (pas en %), aucune note globale, aucune table d'agrégats.
- Consommation : journées ≠ événements ; ne jamais additionner des quantités.
- Mode envie : `craving_events` indépendants du check-in (jamais de modification automatique) ;
  écritures via les RPC `start_craving_event`, `start_craving_intervention`, `update_craving_timer`,
  `complete_craving_event` ; minuteur calculé depuis les horodatages (`getTimerState`) ;
  réduction = initial − final ; analyse des stratégies ≥ 3 interventions terminées ; aucune
  interprétation médicale du score, jamais « Urgence ».
- Mon plan : données CHOISIES par l'utilisateur, jamais déduites des statistiques ; réutiliser les tables
  de l'onboarding ; substance = désactivation (`deactivate_user_substance`), jamais suppression ;
  favoris max 3 et personne principale unique appliqués par la base ; lieux sûrs sans géolocalisation ;
  lettre / rappel / notes jamais journalisés ni dans une URL.
- Accomplissements : événements historiques persistés, jamais retirés ; attribution UNIQUEMENT via la
  RPC `award_achievements()` (aucune écriture client sur `user_achievements`) aux points prévus
  (check-in, moment d'envie, plan, bouton « Enregistrer mes jalons ») ; métriques = mêmes définitions que les Sprints 4/7 ;
  jamais de récompense liée à la consommation, d'XP, de niveau ni de classement.
- Sécurité (Sprint 11, voir `docs/SECURITY.md` / `docs/PRIVACY.md`) : nouvelle table personnelle →
  `user_id` + RLS + clé composite vers le parent + `ON DELETE CASCADE` (vérifier `security_rls.sql`,
  mettre à jour la carte des données et l'export) ; jamais de `service_role` ; SECURITY DEFINER
  seulement sans paramètre `user_id` ; en-têtes dans `next.config.ts` ; Sprint 10 reporté.
- IA (`docs/AI.md`) : opt-in (`ai_preferences`), rien n'est envoyé sans consentement ET clic ;
  jeu de données via `buildWeeklyInsightDataset` seulement (jamais lettre, contacts, lieux, rappel,
  raison, notes, courriel, UUID) ; métriques calculées par le code ; sortie validée par
  `validateWeeklyReflection` ; écriture par `reserve_ai_generation` / `save_ai_reflection` ; clé
  `ANTHROPIC_API_KEY` serveur seulement ; ne jamais journaliser prompt, jeu de données ni réponse ;
  aucun diagnostic, prédiction, causalité, jugement ni chatbot.
- Accomplissements : jamais attribués pendant un rendu GET (ADR-089).
- Journée passée (ADR-098) : check-in possible du début du parcours à hier via `/journal/[date]/edit`
  (`canBackfillCheckin`) ; aujourd'hui via `/today/checkin` ; formulations via `forCheckinDay`.
- Rapport PDF (`docs/PDF_EXPORT.md`) : page imprimable `(report)`, `no-store` + `noindex`, jamais
  la lettre ni les contacts ; aucun service PDF tiers ; à l'impression, blocs simples (pas de grille).
- Bêta V1 (`docs/BETA_*.md`) : avis via `beta_feedback` seulement (aucune capture, aucun outil tiers) ;
  redirections absolues des Route Handlers via `resolveRedirectOrigin()` (jamais `request.url` seul) ;
  CSP aussi en meta (le CDN de l'hébergeur remplace l'en-tête) ; pas de Sprint 14 avant les retours.
- Calendrier : champs minimaux seulement ; journal : `search_journal` (côté base, paginé) ; le terme
  recherché ne va jamais dans l'URL ni dans les journaux.
- Chemins via `src/config/routes.ts` ; redirections via `getSafeRedirect()`.
- Ne jamais journaliser courriel, mot de passe, jeton, cookie ni contenu personnel.
- Journée locale (`date`) séparée des timestamps UTC (ADR-006).
- Couleurs uniquement via les tokens de `src/app/globals.css` ; états = texte + icône + couleur.
- Textes d'interface en français, tutoiement, ton non culpabilisant.
- Avant de conclure : `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
- Mettre à jour `docs/` et proposer un commit (ne jamais `git push` sans autorisation).
