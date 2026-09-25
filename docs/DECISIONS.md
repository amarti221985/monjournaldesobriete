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

- **Statut** : acceptée au Sprint 2 (implémentation du calcul : Sprints 3-4).
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
