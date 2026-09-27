# Sécurité — Mon Journal de Sobriété

Audit technique réalisé au Sprint 11 sur l'état réel du dépôt et du projet Supabase distant
(requêtes sur `pg_class`, `pg_policies`, `pg_constraint`, `pg_proc`, droits de tables et de
colonnes). Ce document décrit des mesures techniques ; il ne constitue pas une attestation de
conformité juridique (voir [PRIVACY.md](./PRIVACY.md)).

## 1. Authentification et sessions

- **Supabase Auth** (courriel + mot de passe), intégré par `@supabase/ssr` : session dans des
  cookies gérés par la bibliothèque (httpOnly côté serveur). Aucune donnée métier n'est placée
  dans un cookie, `localStorage`, `sessionStorage` ou IndexedDB (recherche dans tout `src/` :
  aucune utilisation).
- `src/proxy.ts` rafraîchit la session à chaque navigation et redirige (connexion, onboarding) ;
  chaque layout, page, Server Action et Route Handler protégé revérifie l'utilisateur
  (`requireUser()` / `getCurrentUser()`, JWT vérifié par `getClaims()`).
- **Redirections** : `getSafeRedirect()` n'accepte que des chemins internes d'une liste blanche
  (URL absolues, `//`, `/\`, formes encodées, `javascript:` et caractères de contrôle refusés ;
  tests unitaires). Le callback `/auth/callback` et la réinitialisation utilisent ce helper.
- **Énumération** : inscription et « mot de passe oublié » répondent de la même façon que le
  compte existe ou non ; la connexion renvoie un message générique.
- **Paramètres** (`/settings`) : changement de courriel par le flux officiel
  (`auth.updateUser({ email })`, confirmation par courriel), changement de mot de passe après
  **vérification du mot de passe actuel** (client Supabase isolé, sans cookie ni session
  conservée), déconnexion, déconnexion des autres appareils (`signOut({ scope: "others" })`).
- **Réauthentification** : la suppression du compte et le changement de mot de passe exigent le
  mot de passe actuel, vérifié auprès de Supabase Auth (pas de fausse réauthentification).

## 2. Autorisation : RLS et propriété

- 28 tables dans `public`, **RLS activée sur toutes** (vérifié sur la base distante).
- Tables personnelles : colonne `user_id` (ou `id` pour `profiles`) et policies
  `(select auth.uid()) = user_id` pour chaque opération accordée. Droits minimaux : `SELECT`,
  `INSERT`, `DELETE` seulement là où c'est utile ; `UPDATE` limité à des **colonnes précises**
  (jamais `user_id`, `created_at`, `updated_at`, `local_date`, `onboarding_completed`,
  `substance_id`). `user_achievements` est en lecture seule ; catalogues en lecture seule.
- **Propriété parent / enfant** : chaque table enfant (`checkin_*`, `consumption_events`,
  `craving_event_*`, `craving_interventions`) a une clé étrangère **composite**
  `(parent_id, user_id)` vers le parent : impossible de rattacher une ligne au parent d'un autre
  compte, même avec son UUID. Les références vers `user_substances` sont aussi composites
  (`(user_substance_id, user_id)`), différées au commit (voir §6).
- Tests : `supabase/tests/security_rls.sql` (A / B sur les 25 tables personnelles : lecture,
  modification, suppression, insertion au nom de l'autre, références croisées, RPC avec UUID
  devinés, affectation de masse, dates futures, fuseau, fonctions, suppression du compte) ; tests
  par domaine (`profiles`, `onboarding`, `checkins`, `journal`, `craving`, `plan`,
  `achievements`, `ai`, `beta_feedback`).

## 3. Fonctions (RPC) et SECURITY DEFINER

Toutes les fonctions de `public` ont `search_path = ''`. Les RPC métier sont **SECURITY
INVOKER** (RLS appliquée) et dérivent l'utilisateur de `auth.uid()` ; aucune n'accepte un
`user_id`.

| Fonction SECURITY DEFINER | Justification | Garde-fous |
| --- | --- | --- |
| `handle_new_user()` | trigger sur `auth.users` : crée le profil | non exécutable par l'application ; valide nom et fuseau |
| `complete_onboarding(payload)` | fixe `onboarding_completed` (colonne non modifiable par le client) | `auth.uid()` uniquement, validation complète, idempotente |
| `award_achievements()` | insère dans `user_achievements` (aucune écriture client) | aucun paramètre, critères calculés par la base |
| `get_achievement_progress()` | appelle la fonction interne de métriques | aucun paramètre, `auth.uid()` |
| `delete_my_account()` | supprime la ligne `auth.users` (privilèges requis) | aucun paramètre, `auth.uid()` ; confirmations dans la Server Action |

Fonctions internes non exécutables par `anon` / `authenticated` : `achievement_metric_events`,
`award_achievements_for`, fonctions de trigger (`set_updated_at`, `enforce_*`,
`check_checkin_consumption_consistency`, `ensure_onboarding_requirements`). SQL dynamique : un
seul usage, `format('%I')` sur le nom de table du trigger (`enforce_max_favorites`), sans entrée
utilisateur.

## 4. Server Actions et Route Handlers

Audit des 7 fichiers d'actions (`auth`, `onboarding`, `checkin`, `journal`, `craving`, `plan`,
`settings`, `profile`) : chaque mutation récupère l'utilisateur de la session, valide l'entrée
avec Zod (seuls les champs déclarés sont conservés : pas d'affectation de masse), vise ses
propres lignes (filtre `user_id` + RLS ; 0 ligne → « introuvable ») et renvoie des erreurs
génériques (jamais de SQL, pile ni schéma).

| Route Handler | Accès | Remarques |
| --- | --- | --- |
| `GET /auth/callback` | public | échange du code / `token_hash`, `next` validé |
| `GET /api/health` | public | seulement « configuré oui / non » (aucune valeur) |
| `POST /api/account/export` | session + même origine | `auth.uid()` seulement, `no-store`, limité à 1 export / 10 s |

- **CSRF** : les Server Actions de Next.js n'acceptent que des POST dont l'en-tête `Origin`
  correspond à l'hôte ; la suppression du compte revérifie explicitement la même origine ;
  l'export exige un POST de même origine. Cookies de session `SameSite=Lax` (Supabase SSR).
- **CORS** : aucun en-tête `Access-Control-Allow-Origin` (vérifié par les tests d'intégration).
- **Injection SQL** : aucune requête SQL construite par concaténation dans l'application
  (constructeur de requêtes Supabase / RPC paramétrées).
- **XSS** : aucun `dangerouslySetInnerHTML`, aucun rendu Markdown ; React échappe tout
  (test d'intégration avec `<script>alert(1)</script>` dans une réflexion).
- **IDOR** : `/journal/[date]` et `/craving/[id]` lisent avec `user_id = session` + RLS ; un
  identifiant ou une date d'un autre compte n'affiche rien (tests d'intégration).
- **Longueurs** : chaque texte a une limite Zod et une contrainte `CHECK` en base.

## 5. Invariants appliqués par la base (quel que soit le chemin d'écriture)

Une session authentifiée peut appeler l'API Supabase directement pour ses propres lignes. La base
applique donc elle-même : aucune date métier future (`checkin_date`, `local_date`,
`started_on`), 6 substances actives au maximum, fuseau IANA réel, cohérence statut /
consommations, scores et longueurs, un check-in par jour, favoris (3), personne principale unique.

## 6. Suppression du compte et cascades

`delete_my_account()` supprime `auth.users` (utilisateur courant) : toutes les tables
personnelles suivent par `ON DELETE CASCADE`, directement ou via leur parent, **dans la même
transaction** (aucun état partiel). Les références `consumption_events` /
`craving_event_substances` → `user_substances` sont **différées** : sans cela, la suppression d'un
compte ayant des consommations échouait (constat du Sprint 11, corrigé). Après la suppression, la
session locale et les cookies `sb-*` sont effacés ; redirection vers `/account-deleted`.
Vérifié sur la base distante : aucune ligne de l'utilisateur supprimé dans les 24 tables
personnelles ni dans `auth.users`, l'autre utilisateur intact.

## 7. Journaux, secrets, dépendances

- Journaux serveur : uniquement des codes techniques (`{ code, status }`), jamais de courriel,
  mot de passe, jeton, cookie, texte de journal, raison, lettre, contexte ou contact. Les pages
  d'erreur client ne journalisent que le `digest`.
- Variables : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (clé publiable,
  conçue pour le navigateur), `NEXT_PUBLIC_SITE_URL`. Seul secret serveur : `ANTHROPIC_API_KEY` (facultatif, lu à
  l'exécution par `src/lib/ai/anthropic-provider.ts`, module `server-only`, jamais `NEXT_PUBLIC_*`).
  Pas de clé `service_role` / `sb_secret_`. `.env*` ignoré par git sauf `.env.example` (sans valeur) ;
  aucun fichier de secret suivi.
- Dépendances d'exécution : Next.js, React, `@supabase/ssr` / `supabase-js`, Radix UI,
  `lucide-react`, Recharts, Zod, `cn` (paquet officiel shadcn, fusion de classes),
  `@anthropic-ai/sdk` (côté serveur, bilans intelligents opt-in). Aucun outil d'analytique, de
  relecture de session ni de publicité.
- IA : journaux limités à `request_id`, modèle, `stop_reason`, latence, jetons ; jamais le prompt,
  le jeu de données, la réponse ni le journal (`docs/AI.md`).

## 7 bis. Bilans intelligents et rapport PDF (Sprint 12)

- `ai_preferences` : RLS propriétaire ; droits de colonnes (insert / update des préférences
  seulement, jamais `last_generation_at`). `ai_reflections` : lecture et
  suppression seulement ; écriture par `save_ai_reflection()`.
- `reserve_ai_generation()` / `save_ai_reflection()` : SECURITY DEFINER sans paramètre
  d'utilisateur (`auth.uid()`), `search_path = ''`, consentement actif exigé, un bilan par 24 heures glissantes,
  non exécutables par `anon`. `release_ai_generation(jeton)` rend un essai échoué côté fournisseur ;
  jeton secret gardé côté serveur, table `ai_generation_reservations` sans aucun droit client.
  Tests : `supabase/tests/ai_rls.sql` (24 vérifications).
- Contrôles AVANT réservation (consentement, clé, données suffisantes) ; aucun appel au fournisseur
  sans consentement (vérifié en intégration avec un faux fournisseur local).
- Rapport `/reports/personal` : session + onboarding, RLS, `Cache-Control: private, no-store`,
  `X-Robots-Tag: noindex`, jamais la lettre ni les contacts.
- Aucun accomplissement attribué pendant un rendu GET ou un préchargement (ADR-089).

## 7 ter. Bêta V1 (Sprint 13)

- `beta_feedback` : RLS propriétaire, insertion (colonnes explicites) et lecture seulement, aucune
  modification ni suppression par le client, section limitée à une liste fermée (jamais une URL),
  20 avis / 24 h (déclencheur SECURITY DEFINER non exécutable par les clients). Test :
  `supabase/tests/beta_feedback_rls.sql` (10 vérifications) ; incluse dans `security_rls.sql`.
- Callback d'authentification : redirections construites depuis `NEXT_PUBLIC_SITE_URL` (ADR-093) ;
  en production, `request.url` contenait l'adresse interne du serveur.
- Notification d'avis (ADR-097) : `RESEND_API_KEY` serveur seulement (`src/lib/services/notifications.ts`,
  `server-only`), courriel en texte brut (aucune injection HTML), journaux limités au code HTTP ;
  un échec n'annule jamais l'avis enregistré.
- Hostinger : le CDN remplace l'en-tête CSP ; la même politique est livrée en balise meta (ADR-094).
  Les autres en-têtes (`X-Frame-Options`, HSTS, `no-store`, `X-Robots-Tag`) arrivent intacts.

## 8. En-têtes HTTP (`src/config/security-headers.ts`, appliqués par `next.config.ts`)

`Content-Security-Policy` (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`,
`base-uri 'self'`, `form-action 'self'`, `connect-src 'self' https://*.supabase.co`),
`X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `Permissions-Policy`
(caméra, micro, géolocalisation, paiement, USB désactivés), `X-Frame-Options: DENY`,
`Strict-Transport-Security` (hors développement), sans `X-Powered-By`.

## 9. Limitations connues

- **CSP** : `'unsafe-inline'` reste autorisé pour les scripts (hydratation Next.js) ; une CSP à
  nonce imposerait un rendu dynamique de toutes les pages.
- **Écritures directes sur ses propres lignes** : via l'API, un utilisateur peut créer des données
  que l'interface ne permet pas (ex. check-in antidaté). Impact limité à ses propres statistiques
  et accomplissements ; aucune portée inter-comptes (RLS + clés composites + invariants §5).
- **Oracle d'existence** : pour qui connaît déjà deux UUID aléatoires d'un autre compte, l'ordre
  des contrôles (index unique avant clé étrangère) peut révéler l'existence d'une relation ; aucune
  donnée n'est divulguée et l'écriture est refusée.
- **Jeton d'accès** : après une déconnexion des autres appareils ou une suppression, un JWT déjà
  émis reste cryptographiquement valide jusqu'à son expiration (1 h par défaut) ; il ne peut plus
  être rafraîchi et, après suppression, aucune écriture n'est possible (clés étrangères vers
  `auth.users`).
- **Limite de fréquence** : l'export est limité en mémoire (une instance Node) ; connexion et
  réinitialisation reposent sur les limites de Supabase Auth.
- **Effets de bord idempotents au rendu** : `/achievements` (et `/today` tant qu'aucun
  accomplissement n'existe) attribuent les accomplissements au chargement, y compris lors d'un
  préchargement de lien ; l'opération est idempotente et limitée au compte courant.
- **Pas de MFA** ; pas de journal d'audit des connexions côté application.
- **Sauvegardes du fournisseur** : Supabase peut conserver des sauvegardes selon sa propre
  politique ; la suppression efface les données de la base active.
- **Réinitialisation du parcours** (garder le compte, effacer les données) : non implémentée
  (comportement jugé ambigu pour le Sprint 11 ; la suppression complète est prioritaire).
