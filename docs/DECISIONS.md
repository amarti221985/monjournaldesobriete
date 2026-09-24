# Architecture Decision Log

Chaque décision importante est consignée ici pour qu'un futur développeur (ou une future
session Claude Code) comprenne **pourquoi** elle a été prise. On ne modifie pas une décision
acceptée : on en ajoute une nouvelle qui la remplace (statut « Remplacée par ADR-XXX »).

| ADR | Titre | Statut |
| --- | --- | --- |
| 001 | Next.js App Router | Acceptée |
| 002 | Supabase pour Auth + PostgreSQL | Acceptée |
| 003 | Application web responsive mobile-first | Acceptée |
| 004 | RLS obligatoire pour les données utilisateur | Acceptée |
| 005 | Progression globale plutôt que série seule | Acceptée |
| 006 | Dates locales séparées des timestamps UTC | Acceptée |
| 007 | Check-in global + statut par substance | Acceptée (détails au Sprint 3) |
| 008 | Règle de la série et objectifs « réduire » / « observer » | Proposée — à confirmer au Sprint 3 |
| 009 | Hébergement Hostinger Business (Node.js) et Node 24 LTS | Acceptée |
| 010 | Supabase cloud sans dépendance à Docker | Acceptée |
| 011 | npm comme gestionnaire de paquets | Acceptée |
| 012 | Clés Supabase publiables et validation paresseuse des variables | Acceptée |
| 013 | Langue et ton de l'interface | Acceptée |
| 014 | Projet hors OneDrive | Acceptée |
| 015 | Vitest dès le Sprint 0 | Acceptée |

---

## ADR-001 — Next.js App Router

- **Context** : il faut un framework React moderne, performant sur mobile, avec rendu serveur
  pour limiter le JavaScript client et garder les accès aux données côté serveur.
- **Decision** : Next.js 16 avec App Router, TypeScript strict, Server Components par défaut.
- **Reason** : Server Components et Server Actions réduisent le JS client et gardent la logique
  sensible côté serveur ; route groups et layouts imbriqués structurent naturellement les zones
  publique / auth / application ; écosystème mature (shadcn/ui, Supabase SSR).
- **Consequences** : `"use client"` seulement là où c'est nécessaire. Respecter les conventions
  Next 16 (`proxy.ts` au lieu de `middleware.ts`, `retry` dans `error.tsx`, docs locales dans
  `node_modules/next/dist/docs/`). Nécessite un runtime Node (pas d'export statique).

## ADR-002 — Supabase pour Auth + PostgreSQL

- **Context** : besoin d'une authentification fiable, d'une base relationnelle et d'une sécurité
  au niveau des lignes, sans maintenir un backend séparé.
- **Decision** : Supabase (Auth + PostgreSQL), intégré via `@supabase/ssr` (sessions en cookies).
- **Reason** : PostgreSQL relationnel adapté aux données du journal ; RLS native ; Auth complète
  (inscription, réinitialisation, sessions) ; migrations SQL versionnables via la CLI.
- **Consequences** : schéma exclusivement géré par migrations (`supabase/migrations/`). Types
  TypeScript générés depuis le schéma. Dépendance à un fournisseur, atténuée par l'usage de SQL
  standard.

## ADR-003 — Application web responsive mobile-first

- **Context** : le check-in quotidien se fera surtout sur téléphone ; pas de budget pour des
  applications natives.
- **Decision** : une seule webapp responsive conçue d'abord pour 375–430 px, puis tablette et
  desktop ; transformation en PWA au Sprint 10.
- **Reason** : un seul code, déploiement simple, installation possible via PWA.
- **Consequences** : chaque écran est d'abord conçu et vérifié en mobile. Navigation : barre
  inférieure sur mobile, sidebar à partir de `lg`. Cibles tactiles ≥ 40 px (48 px pour les
  actions principales).

## ADR-004 — RLS obligatoire pour les données utilisateur

- **Context** : données extrêmement sensibles (consommation, émotions, journal). La clé
  Supabase utilisée par le navigateur est publique par conception.
- **Decision** : toute table contenant des données utilisateur active la RLS avec des
  politiques explicites basées sur `auth.uid()`, dans la même migration que sa création.
- **Reason** : la protection ne doit jamais dépendre du frontend ; défense en profondeur.
- **Consequences** : `user_id` déterminé côté serveur / par défaut `auth.uid()`, jamais fourni
  par le client. La clé secrète (service role) contourne la RLS : usage serveur uniquement,
  limité et documenté. Les politiques RLS seront testées.

## ADR-005 — Progression globale plutôt que série seule

- **Context** : un compteur unique qui retombe à zéro après une consommation est démotivant
  et contraire à la philosophie « Progression > perfection ».
- **Decision** : plusieurs métriques (série actuelle, meilleure série, journées sobres
  cumulatives, journées suivies, % de journées sobres, tendances). Une consommation peut
  terminer la série actuelle, mais ne remet jamais à zéro le cumul, la meilleure série,
  l'historique ou les accomplissements.
- **Reason** : reconnaître la trajectoire globale ; ton non culpabilisant.
- **Consequences** : logique de calcul centralisée dans des fonctions pures testées ; valeurs
  dérivées calculées plutôt que stockées ; l'UI ne met jamais la série seule en avant.

## ADR-006 — Dates locales séparées des timestamps UTC

- **Context** : un check-in fait à 23 h dans l'Est du Canada tombe le lendemain en UTC. Les
  statistiques par journée seraient fausses.
- **Decision** : la journée vécue est une colonne `date` (`local_date`), calculée dans le fuseau
  IANA de l'utilisateur (stocké dans son profil) au moment de la saisie, puis figée. Les instants
  techniques sont des `timestamptz` (UTC).
- **Reason** : la journée locale est le concept métier ; l'UTC est un détail technique.
- **Consequences** : unicité `(user_id, local_date)` ; statistiques calculées sur `local_date` ;
  helpers de dates centralisés et testés (changement de jour, de mois, d'année, fuseaux).
  Un changement de fuseau (voyage) ne recalcule pas les journées déjà enregistrées.

## ADR-007 — Check-in global + statut par substance

- **Context** : un utilisateur peut suivre plusieurs substances. Un statut unique par jour
  (`sober` / `consumed`) est ambigu s'il a consommé une seule d'entre elles.
- **Decision** : un check-in **global** par jour (humeur, énergie, stress, envie, réflexions) et
  un **statut par substance suivie** (`checkin_substance_statuses` : `sober` / `consumed`),
  complété par `consumption_events` pour les détails. Le statut **affiché** du jour est dérivé :
  `consumed` si au moins une substance est consommée ; sinon `sober_with_craving` si
  `craving_score` ≥ seuil configurable (7 par défaut) ; sinon `sober`.
- **Reason** : les séries et statistiques restent exactes par substance, sans dupliquer les
  données communes du check-in.
- **Consequences** : le statut du jour n'est jamais stocké en double. États visuels
  correspondants : `sober`, `challenging`, `consumed`, `untracked` (`src/config/day-status.ts`).
  Le schéma exact est conçu au Sprint 3.

## ADR-008 — Règle de la série et objectifs « réduire » / « observer »

- **Statut** : proposée, à confirmer par le porteur du projet avant le Sprint 3.
- **Context** : il faut définir l'effet d'une journée sans check-in et le sens d'une série
  lorsque l'objectif n'est pas l'arrêt.
- **Decision proposée** :
  - Série actuelle (substance à objectif « arrêter ») = jours depuis la dernière consommation
    enregistrée (ou depuis la date de début).
  - Une journée **sans check-in** ne casse pas la série (on ne suppose jamais une consommation),
    mais ne compte **pas** dans les journées sobres cumulatives, qui ne comptent que des jours
    confirmés. Elle apparaît comme « non renseignée » et peut être complétée après coup.
  - Objectif « réduire » : pas de série de sobriété ; on met en avant les jours avec
    consommation, les quantités et leur évolution (limite personnelle possible plus tard).
  - Objectif « observer » : suivi uniquement, ni série ni objectif affiché.
- **Reason** : cohérent avec « Progression > perfection » et honnête sur les données réelles.
- **Consequences** : distinguer « sobre confirmé » et « non renseigné » dans tous les calculs.

## ADR-009 — Hébergement Hostinger Business (Node.js) et Node 24 LTS

- **Context** : le porteur dispose d'un hébergement Hostinger Business avec l'option
  « Node.js Web App », déployée depuis GitHub.
- **Decision** : déploiement comme application Node standard (`npm ci && npm run build`, puis
  `npm start`). Aucune dépendance à Vercel ou à une plateforme spécifique. Node **24 LTS**
  recommandé (`.nvmrc`), minimum 20.9 (`engines`).
- **Reason** : Next 16 avec rendu serveur, Server Actions et proxy exige un serveur Node ; un
  export statique casserait l'authentification côté serveur.
- **Consequences** : les variables d'environnement sont saisies dans hPanel. Vérifier les
  versions de Node proposées par Hostinger (24 sinon 22). Ne pas utiliser d'API propres à Vercel.

## ADR-010 — Supabase cloud sans dépendance à Docker

- **Context** : poste Windows Home ; Docker Desktop + WSL2 est lourd pour ce projet.
- **Decision** : développement contre un projet Supabase **cloud** de développement (région
  Canada (Central)) ; un projet distinct pour la production plus tard. Migrations écrites à la
  main et appliquées avec `npx supabase db push`.
- **Reason** : aucune installation lourde ; données hébergées au Canada (pertinent pour la
  Loi 25 au Québec).
- **Consequences** : pas de `supabase db diff` ni de base locale jetable. Les migrations doivent
  être relues avec soin avant `db push`. Supabase local reste possible plus tard (`supabase/config.toml`
  est versionné).

## ADR-011 — npm comme gestionnaire de paquets

- **Context** : aucun lockfile existant ; npm déjà installé.
- **Decision** : npm exclusivement ; `package-lock.json` versionné.
- **Reason** : outil standard, supporté nativement par Hostinger.
- **Consequences** : ne jamais mélanger avec pnpm, yarn ou bun.

## ADR-012 — Clés Supabase publiables et validation paresseuse des variables

- **Context** : Supabase remplace les clés `anon` / `service_role` par des clés publiables
  (`sb_publishable_...`) et secrètes (`sb_secret_...`).
- **Decision** : variables `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  validées par Zod dans `src/lib/env.ts` **au premier usage** (pas au chargement du module).
  Aucun secret serveur tant qu'aucun sprint n'en a besoin.
- **Reason** : erreur claire si une variable manque, sans rendre fragile le build des pages
  qui n'utilisent pas Supabase.
- **Consequences** : une clé `anon` historique (JWT) fonctionne aussi dans la même variable.
  Les secrets futurs auront un module séparé, importable uniquement côté serveur.

## ADR-013 — Langue et ton de l'interface

- **Decision** : interface en français, tutoiement, français neutre compréhensible au Québec
  comme ailleurs (« courriel »). Valeurs techniques en anglais (`sober`, `consumed`), libellés
  français centralisés dans `src/config/`.
- **Consequences** : aucune bibliothèque d'i18n pour l'instant ; les libellés centralisés
  rendent une traduction future possible.

## ADR-014 — Projet hors OneDrive

- **Context** : le dossier initial était dans OneDrive, avec un caractère accentué dans le chemin.
- **Decision** : projet dans `C:\dev\journal-sobriete` ; la sauvegarde passe par Git/GitHub.
- **Reason** : la synchronisation OneDrive de `node_modules` et `.next` est lente et provoque
  des verrous de fichiers ; certains outils gèrent mal les chemins accentués.

## ADR-015 — Vitest dès le Sprint 0

- **Decision** : Vitest pour les tests unitaires (`npm test`), fichiers `*.test.ts` colocalisés.
  Playwright sera ajouté quand des parcours utilisateur existeront.
- **Reason** : léger, rapide, compatible TypeScript et alias `@/*` sans configuration lourde ;
  prêt pour les fonctions critiques (séries, dates, statistiques).
