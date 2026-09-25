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
| 007 | Check-in global + statut par substance | Remplacée en partie par ADR-037 et ADR-040 |
| 008 | Règle de la série et objectifs « réduire » / « observer » | Acceptée (Sprint 2) |
| 009 | Hébergement Hostinger Business (Node.js) et Node 24 LTS | Acceptée |
| 010 | Supabase cloud sans dépendance à Docker | Acceptée |
| 011 | npm comme gestionnaire de paquets | Acceptée |
| 012 | Clés Supabase publiables et validation paresseuse des variables | Acceptée |
| 013 | Langue et ton de l'interface | Acceptée |
| 014 | Projet hors OneDrive | Acceptée |
| 015 | Vitest dès le Sprint 0 | Acceptée |
| 016 | Supabase Auth par courriel et mot de passe | Acceptée |
| 017 | Création du profil par trigger PostgreSQL | Acceptée |
| 018 | Protection des routes côté serveur | Acceptée |
| 019 | Fuseaux horaires IANA | Acceptée |
| 020 | `updated_at` maintenu par la base | Acceptée |
| 021 | Redirections internes par liste blanche | Acceptée |
| 022 | Code organisé par fonctionnalité (`src/features/`) | Acceptée |
| 023 | Anti-abus et courriels : protections Supabase d’abord | Acceptée |
| 024 | Liens de courriel : PKCE par défaut, `token_hash` recommandé | Acceptée |
| 025 | Onboarding obligatoire avant l'accès à l'application | Acceptée |
| 026 | Architecture multi-substance | Acceptée |
| 027 | Date de début : journée locale, jamais une preuve de sobriété | Acceptée |
| 028 | Finalisation atomique de l'onboarding | Acceptée |
| 029 | Catalogue de substances contrôlé | Acceptée |
| 030 | Une seule substance principale | Acceptée |
| 031 | Brouillon de l'onboarding côté serveur | Acceptée |
| 032 | Objectifs et motivations : enums PostgreSQL | Acceptée |
| 033 | État de l'onboarding vérifié dans le proxy | Acceptée |
| 034 | Un check-in par journée locale | Acceptée |
| 035 | Enregistrement transactionnel du check-in (`save_checkin`) | Acceptée |
| 036 | Relations du check-in : `user_id` + clés étrangères composites | Acceptée |
| 037 | Consommations séparées du check-in | Acceptée |
| 038 | Catalogues contrôlés : émotions, déclencheurs, accomplissements | Acceptée |
| 039 | Brouillons et source des statistiques | Acceptée |
| 040 | Statut choisi par l'utilisateur, indépendant de l'envie | Acceptée |
| 041 | Progression cumulative avant la série | Acceptée |
| 042 | Journées non documentées et séries (implémentation d'ADR-008) | Acceptée |
| 043 | Graphique des scores | Acceptée |
| 044 | Semaine du lundi et « 7 derniers jours » | Acceptée |
| 045 | Tendances descriptives | Acceptée |
| 046 | Calcul du tableau de bord à la volée | Acceptée |
| 047 | Requêtes du calendrier minimales | Acceptée |
| 048 | Journées manquantes : visibles dans le calendrier, absentes du journal | Acceptée |
| 049 | Journal paginé, filtré et recherché côté base | Acceptée |
| 050 | Recherche du journal privée | Acceptée |
| 051 | Check-ins historiques modifiables, sans création rétroactive | Acceptée |
| 052 | Périodes en journées calendaires locales | Acceptée |
| 053 | Les analyses de progression restent dérivées | Acceptée |
| 054 | Seuils minimaux d'échantillon | Acceptée |
| 055 | Analyses descriptives, jamais causales | Acceptée |
| 056 | Aucune note globale de progression | Acceptée |

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

- **Statut** : remplacée en partie au Sprint 3. Le statut du jour est **choisi** par
  l'utilisateur (ADR-040, pas de seuil d'envie) et les consommations sont des événements par
  substance (ADR-037) plutôt qu'une table de statuts par substance.

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

- **Statut** : acceptée au Sprint 2, **implémentée au Sprint 4** (ADR-042).
- **Context** : il faut définir l'effet d'une journée sans check-in et le sens d'une série
  lorsque l'objectif n'est pas l'arrêt.
- **Decision** :
  - Une journée **sans check-in ne casse pas automatiquement** la série, mais **ne compte jamais
    comme journée sobre** : les journées sobres cumulatives ne comptent que des journées
    confirmées. Elle apparaît comme « non renseignée » et peut être complétée après coup.
  - Une journée **explicitement enregistrée comme consommation** interrompt la série actuelle
    de la substance concernée (sans jamais effacer le cumul, la meilleure série ni l'historique).
  - La date de début déclarée ne crée aucune journée sobre (ADR-027).
  - Objectif « réduire » : pas de série de sobriété ; on met en avant les jours avec
    consommation, les quantités et leur évolution (limite personnelle possible plus tard).
  - Objectif « observer » : suivi uniquement, ni série ni objectif affiché.
- **Reason** : cohérent avec « Progression > perfection » et honnête sur les données réelles.
- **Consequences** : distinguer « sobre confirmé » et « non renseigné » dans tous les calculs.
  Le moteur de série n'est pas encore codé.

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

## ADR-016 — Supabase Auth par courriel et mot de passe

- **Context** : il faut une authentification fiable dès le Sprint 1, sans gérer soi-même les
  mots de passe, la réinitialisation ni les sessions.
- **Decision** : Supabase Auth (courriel + mot de passe) via `@supabase/ssr`, sessions en cookies.
  Mot de passe : **8 à 72 caractères**, sans règle de composition (majuscule, chiffre, symbole).
  Nom d'affichage requis (2 à 80 caractères).
- **Reason** : les mots de passe ne transitent jamais par notre base ; la longueur protège mieux
  qu'une composition imposée (recommandations NIST) ; 72 est la limite réelle de bcrypt côté
  Supabase. Le nom d'affichage permet un accueil personnel dès la première visite.
- **Consequences** : la même règle est configurée dans le dashboard (longueur minimale 8).
  Messages d'erreur génériques pour ne pas révéler l'existence d'un compte.

## ADR-017 — Création du profil par trigger PostgreSQL

- **Context** : chaque compte `auth.users` doit avoir un profil, même si l'utilisateur ferme
  son navigateur juste après l'inscription.
- **Decision** : trigger `on_auth_user_created` (`AFTER INSERT` sur `auth.users`) appelant
  `public.handle_new_user()` (`SECURITY DEFINER`, `search_path` vide). `display_name` et
  `timezone` proviennent des métadonnées d'inscription, **revalidées** dans le trigger.
- **Reason** : création atomique avec le compte, indépendante du frontend ; aucune politique
  `INSERT` n'est nécessaire (least privilege).
- **Consequences** : les métadonnées étant modifiables par le client, elles ne sont qu'une
  valeur initiale ; une valeur invalide devient `NULL` sans bloquer l'inscription. Toute
  évolution du profil initial passe par une migration de cette fonction.

## ADR-018 — Protection des routes côté serveur

- **Context** : un contrôle uniquement dans le navigateur ou uniquement dans le proxy peut être
  contourné (matcher mal configuré, appel direct d'une Server Action).
- **Decision** : trois niveaux :
  1. `src/proxy.ts` rafraîchit la session et redirige (`/today` → `/login?next=...`,
     `/login` connecté → `/today`) ;
  2. le layout `(app)` et chaque page / Server Action protégée appellent `requireUser()` /
     `getCurrentUser()` (`src/lib/auth/session.ts`) ;
  3. la RLS en base.
  L'identité est établie avec `supabase.auth.getClaims()` (JWT vérifié), jamais `getSession()` seul.
- **Reason** : défense en profondeur ; recommandation Next.js 16 (« vérifier dans chaque
  Server Function ») et Supabase.
- **Consequences** : `getCurrentUser` et `getCurrentProfile` sont mémorisés par requête
  (React `cache`) pour éviter les requêtes dupliquées. Pas de Context React global pour
  l'utilisateur : les données sont lues côté serveur et passées en props.

## ADR-019 — Fuseaux horaires IANA

- **Context** : les journées locales (ADR-006) exigent de connaître le fuseau de l'utilisateur,
  y compris lors des changements d'heure.
- **Decision** : `profiles.timezone` stocke un identifiant IANA (`America/Toronto`), jamais un
  décalage (`UTC-4`). Détection via `Intl.DateTimeFormat().resolvedOptions().timeZone` :
  transmise à l'inscription, sinon enregistrée à la première visite de l'app (`TimezoneSync`)
  si le profil n'en a pas. Validation côté application (`isValidTimeZone`) et côté base
  (forme par `CHECK`, existence par `pg_timezone_names` dans le trigger).
- **Reason** : un identifiant IANA suit les règles d'heure d'été ; un décalage fixe devient faux
  deux fois par an.
- **Consequences** : la détection n'écrase jamais un fuseau existant et ne bloque jamais l'accès.
  Modification manuelle prévue dans les paramètres (sprint ultérieur).

## ADR-020 — `updated_at` maintenu par la base

- **Decision** : fonction réutilisable `public.set_updated_at()` attachée en `BEFORE UPDATE` à
  chaque table possédant `updated_at` ; `created_at` a une valeur par défaut `now()`.
  `clock_timestamp()` est utilisé pour refléter l'instant réel de la modification.
- **Reason** : aucune dépendance à l'horloge du navigateur ni oubli possible dans le code.
- **Consequences** : l'application n'envoie jamais `created_at` ni `updated_at` (colonnes non
  modifiables par `authenticated`).

## ADR-021 — Redirections internes par liste blanche

- **Context** : le paramètre `next` (connexion, callback Auth) peut servir à une redirection
  ouverte vers un site malveillant.
- **Decision** : `getSafeRedirect()` (`src/lib/auth/redirects.ts`) n'accepte qu'un chemin interne
  normalisé appartenant à `postAuthRedirectPrefixes` (`src/config/routes.ts`) ; sinon destination
  par défaut. Refuse URL absolues, `//`, `\`, `javascript:`, caractères de contrôle, traversées.
- **Consequences** : fonction pure couverte par des tests ; toute nouvelle zone protégée doit
  être ajoutée à `protectedRoutePrefixes`.

## ADR-022 — Code organisé par fonctionnalité (`src/features/`)

- **Context** : l'authentification combine schémas, Server Actions, messages et composants.
- **Decision** : `src/features/<domaine>/` regroupe `actions.ts`, `schemas.ts`, `errors.ts` et
  `components/` d'une fonctionnalité. Restent transverses : `src/components/{ui,layout,forms,shared}`,
  `src/lib/` (Supabase, auth, services, utilitaires), `src/config/`.
- **Reason** : cohésion par fonctionnalité, fichiers courts, pas d'abstraction inutile.
- **Consequences** : remplace l'idée `src/components/<domaine>/` et `src/lib/validation/`
  évoquée au Sprint 0 ; les schémas Zod vivent dans leur fonctionnalité.

## ADR-023 — Anti-abus et courriels : protections Supabase d'abord

- **Decision** : pas de rate limiting applicatif, de CAPTCHA ni de fournisseur de courriel
  externe au Sprint 1 ; on s'appuie sur les limites intégrées de Supabase Auth.
- **Consequences** — à faire **avant un lancement public** :
  - SMTP personnalisé (délivrabilité, expéditeur, volume) ;
  - CAPTCHA Supabase (Attack Protection) si des abus apparaissent : le formulaire transmettra
    `options.captchaToken` ;
  - rate limiting applicatif (ex. par IP sur les Server Actions d'authentification) si les
    limites Supabase ne suffisent pas.
  - Contenu des courriels et notifications toujours **discret** (aucune mention de sobriété,
    dépendance ou substance).

## ADR-024 — Liens de courriel : PKCE par défaut, `token_hash` recommandé

- **Context** : `@supabase/ssr` utilise le flux PKCE ; le lien par défaut ne fonctionne que dans
  le navigateur qui a fait la demande.
- **Decision** : `/auth/callback` accepte `?code=` (PKCE) **et** `?token_hash=&type=`
  (`verifyOtp`). Les modèles de courriel recommandés utilisent `token_hash`
  (docs/SUPABASE_SETUP.md).
- **Consequences** : l'application fonctionne avec les modèles par défaut ; la personnalisation
  des modèles rend les liens utilisables sur un autre appareil.

## ADR-025 — Onboarding obligatoire avant l'accès à l'application

- **Context** : les écrans à venir (check-in, statistiques) dépendent des substances suivies et
  de leurs objectifs.
- **Decision** : tant que `profiles.onboarding_completed = false`, toute route de la zone `(app)`
  redirige vers `/onboarding` ; une fois terminé, `/onboarding` redirige vers `/today` (pas de
  réécriture accidentelle des données). Après connexion : `/onboarding` si incomplet, sinon la
  destination demandée (sûre) ou `/today`. Règles pures dans `src/lib/auth/redirects.ts`
  (`resolveProxyRedirect`, `resolvePostLoginRedirect`, `getAppAccessRedirect`,
  `getOnboardingAccessRedirect`), testées.
- **Consequences** : la vérification est faite dans le proxy (voir ADR-033) **et** dans les
  layouts / pages (défense en profondeur). Une future modification du parcours passera par des
  écrans de paramètres dédiés, jamais par le wizard.

## ADR-026 — Architecture multi-substance

- **Decision** : `user_substances` relie un utilisateur à chaque catégorie suivie, avec son
  **propre objectif** (`goal`), sa **propre date** (`started_on`), `is_primary` et `is_active`.
  « Autre » stocke une précision personnelle (`custom_name`) sans jamais créer d'entrée dans le
  catalogue global. Une seule relation active par substance (index unique partiel).
- **Reason** : ex. cannabis → arrêter, nicotine → réduire, alcool → observer.
- **Consequences** : l'onboarding demande une date générale appliquée à chaque substance ; le
  modèle permet déjà des dates individuelles. `is_active` permet d'arrêter un suivi sans perdre
  l'historique.

## ADR-027 — Date de début : journée locale, jamais une preuve de sobriété

- **Decision** : `started_on` est un `date` PostgreSQL (journée locale déclarée), jamais un
  `timestamptz` ni converti en UTC. Pas de date future : la limite est « aujourd'hui » dans le
  fuseau du profil (ou le fuseau le plus en avance, `Pacific/Kiritimati`, si le fuseau est
  inconnu), identique côté Zod et dans la RPC.
- **Consequences** : la date de début ne génère **aucune** journée sobre. Seules les journées
  réellement enregistrées (check-ins, Sprint 3) alimenteront les statistiques.

## ADR-028 — Finalisation atomique de l'onboarding

- **Context** : éviter `onboarding_completed = true` sans données, les doubles soumissions et
  les enregistrements partiels.
- **Decision** :
  - RPC `public.complete_onboarding(payload jsonb)` : une transaction, verrou `FOR UPDATE` sur le
    profil, revalidation complète des entrées, insertion de toutes les données, passage à
    `onboarding_completed = true`, suppression du brouillon. Idempotente (`already_completed`).
    `SECURITY DEFINER` + `search_path` vide ; identité issue uniquement de `auth.uid()`.
  - Garde-fou en base : trigger `profiles_ensure_onboarding_requirements` qui refuse le passage à
    `true` sans substance active (dont une principale), raison et motivation — quel que soit le
    chemin d'écriture.
  - **Correction du Sprint 1** : `onboarding_completed` n'est plus modifiable directement par
    `authenticated` (privilège de colonne retiré) ; seule la RPC peut le modifier.
- **Consequences** : en cas d'erreur, rien n'est enregistré et le wizard conserve les réponses.
  Le conseiller Supabase signale la RPC `SECURITY DEFINER` exécutable : comportement voulu.

## ADR-029 — Catalogue de substances contrôlé

- **Decision** : table globale `substances` (slug stable, `name_fr`, `category`, `is_active`,
  `sort_order`), alimentée par migration : alcool, cannabis, nicotine, stimulants, opioïdes,
  autre. Lecture seule pour `authenticated` (lignes actives), aucun accès anonyme, aucune
  écriture utilisateur.
- **Consequences** : pas de liste détaillée de drogues ; aucune icône associée aux substances
  (éviter la stigmatisation). Ajouter une catégorie = nouvelle migration.

## ADR-030 — Une seule substance principale

- **Decision** : index unique partiel `user_substances (user_id) WHERE is_primary AND is_active`,
  plus la contrainte `not is_primary or is_active`. Côté application, `resolvePrimarySlug()`
  choisit la seule substance, le choix de l'utilisateur ou la première sélectionnée.
- **Consequences** : notion discrète dans l'interface, utilisée pour personnaliser certains écrans.

## ADR-031 — Brouillon de l'onboarding côté serveur

- **Context** : l'utilisateur peut fermer l'onglet ou rafraîchir ; la raison personnelle et les
  coordonnées d'un contact sont sensibles.
- **Decision** : table `onboarding_drafts` (une ligne par utilisateur, `data jsonb` borné à
  16 Ko, RLS), sauvegardée à chaque « Continuer » et par « Enregistrer et quitter » ; reprise à
  l'étape enregistrée ; supprimée par la finalisation. **Rien n'est stocké dans le navigateur.**
- **Consequences** : reprise possible sur un autre appareil. Si la sauvegarde échoue (réseau),
  le wizard continue et l'indique discrètement ; les réponses restent dans la page.

## ADR-032 — Objectifs et motivations : enums PostgreSQL

- **Decision** : `substance_goal` (`abstinence`, `reduction`, `observation`) et `motivation`
  (`health`, `energy`, `sleep`, `relationships`, `family`, `confidence`, `finances`, `career`,
  `freedom`, `clarity`, `personal_project`, `other`) ; libellés français dans
  `src/features/onboarding/constants.ts`. `user_motivations` : une ligne par motivation,
  `custom_label` réservé à `other`.
- **Reason** : valeurs stables, typées jusque dans `src/types/database.ts`, interrogeables.

## ADR-033 — État de l'onboarding vérifié dans le proxy

- **Context** : un `redirect()` dans un layout survient après le début du streaming
  (`loading.tsx`) : Next.js le transforme en redirection côté client (HTTP 200 + affichage bref).
- **Decision** : pour les routes protégées et `/login`, `/signup`, le proxy lit
  `profiles.onboarding_completed` (une requête légère, uniquement si nécessaire) et redirige en
  HTTP 307. Les layouts gardent leur vérification.
- **Consequences** : une requête supplémentaire par navigation protégée. En cas d'erreur de
  lecture, le proxy laisse passer et le layout décide.

## ADR-034 — Un check-in par journée locale

- **Decision** : `daily_checkins.checkin_date` est un `date` (journée locale), unique par
  utilisateur (`UNIQUE (user_id, checkin_date)`). « Aujourd'hui » est calculé côté serveur par
  `getUserToday(profiles.timezone)` (`src/lib/dates.ts`), jamais avec la date UTC. La date est
  **figée à l'ouverture du wizard** : un check-in commencé à 23 h 58 reste sur cette journée
  après minuit. Aucune journée future (Zod + RPC, fuseau du profil) ; les journées passées sont
  acceptées par le modèle (historique, Sprint 5), mais l'interface ne propose que la journée.
- **Consequences** : fuseau absent du profil → `siteConfig.defaultTimeZone` (`America/Toronto`)
  pour déterminer la journée ; la borne « pas dans le futur » reste tolérante
  (`Pacific/Kiritimati`, ADR-027) pour ne jamais refuser à tort.

## ADR-035 — Enregistrement transactionnel du check-in (`save_checkin`)

- **Decision** : toutes les écritures passent par `public.save_checkin(payload jsonb, finalize
  boolean)`, `SECURITY INVOKER` (RLS et privilèges de l'utilisateur appliqués) :
  verrou sur la journée, upsert du check-in, remplacement des émotions, déclencheurs,
  accomplissements et consommations, puis `completed_at` si `finalize`. Identifiants de
  catalogue transmis par **slug** et revalidés ; substances vérifiées (appartenance + actives).
- **Idempotence** : double soumission → même état (un check-in, aucune ligne dupliquée).
- **Modification** : même wizard, pré-rempli ; `completed_at` d'origine conservé. Un brouillon
  (`finalize = false`) ne peut jamais écraser un check-in terminé (`checkin_already_completed`).
  En modification, rien n'est enregistré avant « Enregistrer les modifications ».

## ADR-036 — Relations du check-in : `user_id` + clés étrangères composites

- **Decision** : `checkin_emotions`, `checkin_triggers`, `checkin_achievements` et
  `consumption_events` portent `user_id` et référencent `daily_checkins (id, user_id)` ;
  `consumption_events` référence aussi `user_substances (id, user_id)`.
- **Reason** : RLS simple (`user_id = auth.uid()`, sans sous-requête sur le parent) et
  impossibilité, **garantie par la base**, de rattacher une ligne au check-in ou à la substance
  d'un autre utilisateur.
- **Consequences** : `ON DELETE CASCADE` depuis le check-in ; une substance suivie n'est jamais
  supprimée en cascade (ni ne peut l'être tant qu'elle a des consommations : on la désactive).

## ADR-037 — Consommations séparées du check-in

- **Decision** : le statut appartient au check-in global ; chaque consommation est un
  `consumption_event` lié à une substance suivie. Plusieurs événements possibles (même substance
  ou substances différentes) ; aucune obligation d'en créer un par substance suivie. Quantité,
  unité, heure (`time`, heure locale : la date est celle du check-in), envie avant : tous
  facultatifs, aucune précision inventée.
- **Cohérence** : pour un check-in **terminé**, `status = 'consumed'` ⇔ au moins un événement.
  Garantie par la RPC **et** par des triggers de contrainte `DEFERRABLE INITIALLY DEFERRED`
  (vérifiés en fin de transaction, quel que soit le chemin d'écriture). `consumed → sober` :
  les événements sont supprimés (confirmation demandée dans l'interface).
- **Envie** : `daily_checkins.craving_score` = envie globale de la journée (toujours demandée,
  même avec consommation) ; `consumption_events.craving_before` = envie juste avant un événement
  précis (facultative).

## ADR-038 — Catalogues contrôlés : émotions, déclencheurs, accomplissements

- **Decision** : tables `emotions` (15, catégories `positive` / `difficult`), `trigger_types`
  (13 ; nom choisi pour éviter la confusion avec les triggers PostgreSQL) et
  `achievement_types` (11), lecture seule, alimentées par migration, slugs stables. Émotions
  nommées par des noms communs (« Joie », « Fierté ») : aucun accord de genre. Précision
  « Autre » pour les déclencheurs et accomplissements uniquement. « Aucun déclencheur
  particulier » n'est pas stocké : l'absence de lignes suffit.

## ADR-039 — Brouillons et source des statistiques

- **Decision** : un check-in avec `completed_at IS NULL` est un **brouillon**, enregistré côté
  serveur à chaque changement d'étape (aucune donnée dans le navigateur) et repris à la
  première étape utile. Seuls les check-ins **terminés** (`completed_at IS NOT NULL`)
  compteront comme journées suivies, sobres ou avec consommation (Sprints 4+). « Recommencer »
  supprime le brouillon (politique `DELETE` limitée aux brouillons) ; un check-in terminé n'est
  jamais supprimé depuis l'application.
- **Consequences** : aucun agrégat stocké ; les statistiques seront calculées depuis les
  check-ins terminés. Un check-in terminé exige ses 4 scores (contrainte `CHECK`).

## ADR-040 — Statut choisi par l'utilisateur, indépendant de l'envie

- **Decision** : `sober`, `sober_with_craving` et `consumed` sont choisis explicitement ;
  `sober_with_craving` n'est jamais déduit de `craving_score` (envie 8 + « sober » est valide).
- **Consequences** : l'état visuel de la journée découle du statut choisi (`sober` → sobre,
  `sober_with_craving` → difficile, `consumed` → avec consommation). ADR-007 (seuil d'envie)
  est remplacée sur ce point.

## ADR-041 — Progression cumulative avant la série

- **Context** : un tableau de bord centré sur la série donne l'impression que tout est perdu
  après une consommation.
- **Decision** : hiérarchie de `/today` : aujourd'hui → progression cumulative → constance
  (semaine) → compréhension (graphique, tendances) → série. La valeur dominante est le nombre
  de **journées sobres enregistrées** ; la série actuelle est une métrique parmi quatre.
- **Définitions** (check-ins terminés uniquement, ADR-039) :
  - **Jours suivis** = nombre de check-ins terminés ;
  - **Jours sobres** = statut `sober` ou `sober_with_craving` — ne revient jamais à zéro ;
  - **Jours avec consommation** = statut `consumed` (une journée, quel que soit le nombre
    d'événements) ;
  - **Taux de sobriété** = jours sobres / jours suivis × 100, affiché avec 1 décimale ;
    aucun taux (pas de « 0 % ») sans check-in.
- **Consequences** : après une consommation, le cumul et la meilleure série restent visibles ;
  la série actuelle passe à 0 avec un message neutre. Métriques globales (statut du jour) :
  pas de série par substance pour l'instant.

## ADR-042 — Journées non documentées et séries (implémentation d'ADR-008)

- **Decision** : une journée sans check-in terminé est **inconnue** : elle n'est ni sobre ni
  avec consommation, ne compte pas dans le taux, n'ajoute rien à la série et n'est jamais
  interprétée comme une consommation.
  - **Série actuelle** = journées sobres **enregistrées** depuis la dernière consommation
    enregistrée (les journées manquantes sont ignorées : lun S, mar —, mer S, jeu S → 3).
  - **Meilleure série** = plus grand nombre de journées sobres enregistrées entre deux
    consommations enregistrées.
  - Libellés : « journées sobres enregistrées », jamais « jours consécutifs ».
- **Implémentation** : `calculateStreaks()` (`src/features/progress/metrics.ts`), testée.

## ADR-043 — Graphique des scores

- **Decision** : un seul graphique (Recharts) : humeur, stress, envie sur 7 ou 30 jours
  (aujourd'hui inclus). Journée sans check-in = absence de point (`connectNulls = false`),
  jamais 0. Couleurs dédiées (`--series-mood`, `--series-stress`, `--series-craving`), distinctes
  des couleurs d'état de journée, **validées** (bande de luminosité, chroma, séparation
  daltonisme, contraste) en clair et en sombre ; encodage secondaire par motif de trait.
- **Accessibilité** : légende textuelle, info-bulle (date + scores, aucun texte personnel),
  résumé textuel des moyennes (1 décimale, format français) et tableau « Voir les valeurs » ;
  le tracé est masqué aux lecteurs d'écran au profit de ces équivalents.

## ADR-044 — Semaine du lundi et « 7 derniers jours »

- **Decision** : « Cette semaine » va du **lundi au dimanche** (usage fr-CA). « Tes 7 derniers
  jours » = aujourd'hui + les 6 jours calendaires précédents (et non les 7 derniers check-ins).
  Toutes les journées sont calculées dans le fuseau du profil (`getUserToday`). Jours futurs
  = « À venir » (jamais « non documentés ») ; aujourd'hui sans check-in = « à compléter ».
- **Consequences** : seule la journée d'aujourd'hui est interactive dans la semaine (Sprint 5 :
  historique).

## ADR-045 — Tendances descriptives

- **Decision** : pas d'IA ; quelques règles simples, centralisées dans
  `src/features/progress/insights.ts`, calculées uniquement sur les check-ins terminés :
  | Règle | Données minimales | Seuil d'affichage |
  | --- | --- | --- |
  | Évolution (stress, envie ou humeur) : 7 derniers check-ins vs 7 précédents | 14 check-ins | écart ≥ 1 point |
  | Envie les jours avec / sans déclencheur « stress » | 10 check-ins, ≥ 3 jours dans chaque groupe | écart ≥ 1,5 |
  | Envie les jours avec / sans « activité physique » | idem | écart ≥ 1,5 |
  | Jour de la semaine où l'envie moyenne est la plus élevée | 14 check-ins, ≥ 3 observations ce jour | ≥ 1,5 au-dessus de la moyenne |
  Aucune observation avant **7 check-ins terminés** ; **3 observations au maximum**.
- **Formulations** : descriptives (« Dans tes données… », « sont associées à »), jamais
  causales, jamais médicales, sans diagnostic ni prédiction ; vérifié par des tests.

## ADR-046 — Calcul du tableau de bord à la volée

- **Decision** : aucun agrégat persisté (pas de `current_streak`, `total_sober_days`, ni table
  `statistics`). `/today` lance en parallèle 5 lectures (check-in du jour avec relations,
  substances suivies, motivations, raison, check-ins terminés) après le profil ; la progression
  est calculée par `buildDashboard()` (fonctions pures). La lecture statistique ne ramène que les
  colonnes utiles (date, statut, 4 scores, slugs des déclencheurs et accomplissements), jamais
  de texte personnel.
- **Consequences** : suffisant pour quelques centaines de check-ins par utilisateur ; une
  optimisation (vue SQL, agrégats) pourra être ajoutée si le volume l'exige. En cas d'erreur de
  lecture, un message remplace la progression : jamais de statistiques à zéro.

## ADR-047 — Requêtes du calendrier minimales

- **Decision** : le calendrier ne lit que `checkin_date`, `status` et `completed_at`, sur la
  période affichée (un mois ou une année), en une requête (`getCalendarEntries`). Jamais de
  score, texte, émotion ni consommation pour dessiner la grille. États calculés par
  `getCalendarDayState()` : futur → terminé (statut) → brouillon (« En cours ») → avant le
  parcours → non documenté.
- **Consequences** : le résumé annuel réutilise `calculateSobrietyMetrics()` (une seule
  définition de « jour sobre », ADR-041). Mois et année courants selon `profiles.timezone` ;
  pas de navigation au-delà du mois / de l'année en cours.

## ADR-048 — Journées manquantes : visibles dans le calendrier, absentes du journal

- **Decision** : le calendrier montre les trous (« Aucun check-in ») ; le journal ne liste que
  les check-ins **terminés**. Les jours futurs sont « À venir », jamais « non documentés » ;
  les jours avant le début déclaré du parcours sont neutres (« Avant ton parcours »). Légende
  limitée à 4 états (sobre, forte envie, consommation, non documenté).
- **Interactions** : journée terminée → `/journal/[date]` ; aujourd'hui sans check-in ou en
  cours → check-in du jour ; journée passée non documentée → non cliquable.

## ADR-049 — Journal paginé, filtré et recherché côté base

- **Decision** : fonction SQL `search_journal()` (`SECURITY INVOKER`, RLS) : check-ins terminés,
  `checkin_date DESC`, filtres statut / période, recherche, pagination par curseur de date
  (`p_before`, 20 par page + 1 pour savoir s'il reste une page, « Afficher plus » — pas de
  défilement infini). Les aperçus embarquent émotions et déclencheurs via PostgREST en une
  requête ; le détail complet n'est chargé que sur `/journal/[date]`.
- **Recherche** : `ILIKE` sur `victory_text`, `proud_of_text`, `lesson_text`,
  `tomorrow_intention_text` et `notes`, motif échappé (`%`, `_`, `\` littéraux), terme borné à
  100 caractères, insensible à la casse (pas aux accents : `unaccent` non activé). Suffisant pour
  quelques centaines de journées par utilisateur ; la recherche plein texte PostgreSQL pourra
  remplacer `ILIKE` si le volume l'exige.
- **Index** : aucun ajouté — l'index unique `(user_id, checkin_date)` couvre le filtre par
  utilisateur, la période et l'ordre décroissant.

## ADR-050 — Recherche du journal privée

- **Decision** : le terme recherché ne quitte jamais notre application et Supabase : envoyé dans
  le corps d'une Server Action, **jamais dans l'URL** (seuls `status` et `period` y figurent),
  jamais journalisé ni transmis à un service tiers. Bouton « Rechercher » (pas de requête à
  chaque frappe).

## ADR-051 — Check-ins historiques modifiables, sans création rétroactive

- **Decision** : `/journal/[date]/edit` réutilise le wizard du check-in (mode modification,
  pré-rempli, ouvert au résumé) ; la **date n'est pas modifiable** ; après enregistrement,
  retour au détail relu depuis la base. Seul un check-in **terminé** peut être modifié ; cliquer
  une journée passée sans check-in ne crée rien (V1). La suppression n'est pas exposée dans
  l'interface.
- **Paramètre `[date]`** : format strict `YYYY-MM-DD`, date réelle, jamais future ; sinon page
  introuvable. Lecture limitée à l'utilisateur connecté (filtre `user_id` + RLS) : une date
  d'un autre compte affiche « Aucun check-in enregistré ».
- **Note technique** : le `loading.tsx` racine démarre le streaming avant la validation ; Next.js
  rend alors `notFound()` / `redirect()` côté client avec un statut HTTP 200 (page « introuvable »
  affichée, aucune donnée exposée, pages `noindex`).

## ADR-052 — Périodes en journées calendaires locales

- **Decision** : les périodes de `/progress` (et les filtres du journal, même module
  `src/features/progress/periods.ts`) sont des **journées calendaires** dans le fuseau du profil :
  « 30 jours » = aujourd'hui + les 29 journées précédentes, avec ou sans check-in — pas les
  30 derniers check-ins. « Cette année » = du 1er janvier local à aujourd'hui ; « Tout » = depuis la
  première journée enregistrée. Défaut : 30 jours (`?period=30d`, seule donnée lue dans l'URL).
- **Période précédente** (7, 30, 90 jours) : les N journées qui se terminent la veille du début de la
  période actuelle, sans chevauchement. Pas de comparaison pour « Cette année » et « Tout ».
- **Timezone / DST** : bornes calculées sur des chaînes `YYYY-MM-DD` à partir de
  `getUserToday(profiles.timezone)`, jamais `Date.now() - N × 24 h` : 30 jours restent 30 dates même
  quand la période ne dure pas 720 heures (changement d'heure).

## ADR-053 — Les analyses de progression restent dérivées

- **Decision** : aucune table d'agrégats (`user_analytics`, `progress_statistics`…) ni RPC. Une seule
  requête relationnelle charge les check-ins **terminés** (scores, statut, slugs et libellés des
  déclencheurs / émotions / accomplissements, substance de chaque événement de consommation — ni
  texte personnel, ni quantité) ; tout est calculé par des fonctions pures
  (`buildProgressPage()`), période, période précédente et « Depuis le début » à partir du même jeu.
  Le tableau de bord réutilise la même requête (`getProgressDataset`).
- **Raisons** : volume de quelques centaines de lignes par utilisateur, nombre de requêtes constant
  (2 en parallèle, même avec 100+ check-ins, aucun N+1), aucune définition dupliquée
  (`calculateSobrietyMetrics`, `calculateStreaks`, `buildScoreSeries` du Sprint 4).
- **Index** : aucun ajouté — l'index unique (`user_id`, `checkin_date`) couvre le filtre ; les
  relations sont jointes par leur clé `checkin_id` (clés primaires / index existants).
- **Cache** : `React.cache` par requête serveur seulement ; aucune statistique privée dans un cache
  partagé.

## ADR-054 — Seuils minimaux d'échantillon

- **Decision** : aucune variation, association ni observation sur trop peu de données. Constantes
  `ANALYTICS_THRESHOLDS` (`analytics.ts`) et `PROGRESS_INSIGHT_RULES` (`progress-insights.ts`) :

| Règle | Seuil |
| --- | --- |
| Comparaison numérique de périodes | ≥ 3 check-ins dans **chacune** des deux périodes |
| Score « relativement stable » | écart absolu < 0,5 point |
| Association avec / sans (accomplissement, stress élevé) | ≥ 5 journées par groupe **et** écart ≥ 1 point |
| Stress élevé | stress ≥ 7/10 |
| Jour de la semaine comparé | ≥ 3 check-ins ce jour-là, au moins 2 jours éligibles |
| Déclencheur et journées avec consommation | ≥ 3 journées avec consommation, déclencheur présent ≥ 2 fois |
| Section « Ce que tes données montrent » | ≥ 10 check-ins terminés dans la période |
| Observation d'évolution | ≥ 5 check-ins dans chaque période, écart ≥ 1 point |
| Déclencheur / accomplissement le plus fréquent (observation) | ≥ 3 journées |

- Sous le seuil : « Pas encore assez de données pour comparer ces périodes. » ou « Continue à
  enregistrer tes journées » ; les métriques simples (comptes, moyennes) restent affichées.

## ADR-055 — Analyses descriptives, jamais causales

- **Decision** : 5 observations au plus sur `/progress` (3 sur `/today`, inchangé), générées par des
  règles déterministes (aucune IA), dans l'ordre : évolution récente, déclencheurs, association avec
  l'envie, jour de la semaine, accomplissements. Chaque observation donne sa base (« Basé sur 12
  journées… »). Formulations « dans tes données », « associées à », « apparaît dans » ; jamais « cause »,
  « risque », « rechute », diagnostic ni conseil médical (vérifié par les tests). Mention permanente :
  une fréquence n'indique pas une cause.
- **Écarts** en **points** sur 10 (« −1,2 point »), jamais en pourcentage ; sens décrit par « en
  hausse / en baisse / relativement stable », jamais « bon », « mauvais », « inquiétant ».
- **Émotions** : comptées par émotion, sans « score émotionnel » ni pourcentage positif / négatif.
- **Consommation** : journées ≠ événements ; répartition par substance en nombre d'événements ; les
  quantités (unités hétérogènes) ne sont jamais additionnées ; objectifs rappelés sans verdict.

## ADR-056 — Aucune note globale de progression

- **Decision** : pas de « score de progression », de note sur 100 ni de lettre. La page montre des
  comptes (jours sobres, jours suivis), un taux explicite (jours sobres ÷ check-ins terminés), des
  moyennes et des séries ; chaque chiffre dit ce qu'il mesure et sur quelle période.
