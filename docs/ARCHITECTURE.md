# Architecture

## Stack

| Couche | Choix | Version (Sprint 0) |
| --- | --- | --- |
| Framework | Next.js (App Router, Turbopack) | 16.3.6 |
| UI | React | 19.2.8 |
| Langage | TypeScript (`strict: true`) | 5.x |
| Styles | Tailwind CSS | 4.x |
| Composants | shadcn/ui (style `radix-nova`, primitives Radix) | CLI 4.21.0 |
| Icônes | Lucide React | 1.48.x |
| Validation | Zod | 4.6.x |
| Backend | Supabase (`@supabase/supabase-js`, `@supabase/ssr`) | 2.117.x / 0.12.x |
| Tests | Vitest | 5.0.x |
| Runtime | Node.js 24 LTS recommandé (minimum 20.9, exigence de Next 16) | |

Aussi : `server-only` (empêche l'import de code serveur dans le client).

Ajoutés plus tard, au sprint qui les utilise : Recharts (Sprint 6). React Hook Form n'a pas
été nécessaire au Sprint 1 (formulaires courts : Server Actions + Zod) ; il sera réévalué pour
le check-in (Sprint 3).

## Structure des dossiers

```text
src/
  proxy.ts                  Proxy Next 16 : rafraîchissement de session + redirections d'accès
  app/                      Routes (App Router)
    (marketing)/            Pages publiques : accueil (puis confidentialité, conditions)
    (auth)/                 login, signup, forgot-password, reset-password (+ layout)
    (app)/                  Zone authentifiée : layout (AppShell) + today/
    auth/callback/route.ts  Callback Supabase Auth (confirmation, réinitialisation)
    layout.tsx              Layout racine : police, metadata, providers
    globals.css             Design tokens + Tailwind
    error.tsx, global-error.tsx, not-found.tsx, loading.tsx, icon.svg
  features/                 Code par fonctionnalité (ADR-022)
    auth/
      actions.ts            Server Actions : inscription, connexion, oubli, reset, déconnexion
      schemas.ts            Schémas Zod partagés client / serveur
      errors.ts             Erreurs Supabase → messages humains (anti-énumération)
      components/           Formulaires, AuthCard, UserMenu, SignOutButton
    profile/
      actions.ts            Enregistrement du fuseau détecté
      components/           TimezoneSync
  components/
    ui/                     Composants shadcn/ui (code possédé, modifiable)
    layout/                 SiteHeader/Footer, AppShell, AppHeader, sidebar, nav mobile, PageHeader, PageContainer
    forms/                  FormField, PasswordInput, SubmitButton, FormAlert
    shared/                 BrandMark, StatusMessage
  config/                   site, routes (+ zones protégées / redirections autorisées), navigation, day-status
  hooks/                    use-client-validation
  lib/
    env.ts                  Validation des variables d'environnement (Zod)
    forms.ts                État des formulaires, erreurs Zod par champ
    timezone.ts             Validation / détection des fuseaux IANA
    auth/redirects.ts       getSafeRedirect, resolveProxyRedirect (pur, testé)
    auth/session.ts         getCurrentUser, requireUser (server-only)
    services/profiles.ts    getCurrentProfile, saveTimezoneIfMissing (server-only)
    supabase/               Clients navigateur / serveur / proxy
    utils.ts                cn()
  types/
    database.ts             Types générés depuis le schéma Supabase
supabase/
  config.toml               Configuration CLI Supabase
  migrations/               Migrations SQL versionnées
  tests/                    Scripts SQL de vérification (RLS)
  README.md                 Commandes et règles de migration
docs/                       Documentation projet
```

Les dossiers sont créés **lorsqu'ils contiennent réellement quelque chose**. À venir :
logique métier pure (séries, statistiques, dates locales) dans `src/lib/domain/` ou dans la
fonctionnalité concernée, et une fonctionnalité par dossier dans `src/features/`.

## Route groups

| Groupe | Rôle | Layout |
| --- | --- | --- |
| `(marketing)` | Public. Accueil temporaire. | `SiteHeader` + `SiteFooter` |
| `(auth)` | Connexion, inscription, mot de passe oublié, nouveau mot de passe. | Marque + carte centrée, retour à l'accueil |
| `(app)` | Application authentifiée (`/today`). | `AppShell` (sidebar desktop, barre inférieure mobile, menu utilisateur) |

Un seul layout racine (`src/app/layout.tsx`). La navigation de l'app n'affiche en lien que les
sections disponibles (`available: true` dans `src/config/navigation.ts`) ; les autres sont
désactivées avec la mention « Bientôt ».

## Stratégie frontend / backend

- **Server Components par défaut.** `"use client"` seulement pour l'interactivité (état,
  événements, hooks navigateur). Exemple actuel : `NavLink` (utilise `usePathname`).
- **Écritures** : Server Actions (ou Route Handlers si un endpoint HTTP est nécessaire),
  avec validation Zod côté serveur.
- **Lecture** : Server Components qui appellent des services dans `src/lib/services/`.
  Les composants UI n'importent jamais directement le client Supabase pour des requêtes métier.
- **Logique métier** (séries, statistiques, dates locales) : fonctions pures centralisées et
  testées, jamais dupliquées dans les composants.
- **Aucune dépendance à une plateforme** (pas de Vercel-only) : l'app tourne sur un serveur
  Node standard (`next build` + `next start`), cible Hostinger Business (Node.js Web App).

## Supabase

- `src/lib/supabase/client.ts` : `createBrowserClient` pour les Client Components.
- `src/lib/supabase/server.ts` : `createServerClient` + `cookies()`, un client par requête.
  `cookies()` est lu **avant** la validation des variables : les routes deviennent dynamiques et
  le build ne dépend jamais des clés.
- `src/lib/supabase/proxy.ts` : `updateSession()` (approche officielle `@supabase/ssr`) et
  `redirectWithSession()` (conserve les cookies rafraîchis lors d'une redirection).
- URL du projet + **clé publiable** uniquement, validées par `src/lib/env.ts`. La sécurité des
  données repose sur la **RLS**. Aucune clé secrète n'est utilisée.
- Clients typés avec `Database` (`src/types/database.ts`, `npm run db:types`).

## Authentification (Sprint 1)

### Sessions et protection (ADR-018)

1. **Proxy** (`src/proxy.ts`, toutes les routes hors fichiers statiques) : rafraîchit la session
   via `getClaims()`, puis applique `resolveProxyRedirect()` :
   - visiteur sur une zone protégée → `/login?next=<chemin>` ;
   - utilisateur connecté sur `/login` ou `/signup` → `getAuthenticatedHomeRoute()` (`/today`,
     puis `/onboarding` selon `onboarding_completed` au Sprint 2).
   Si Supabase n'est pas configuré, les pages publiques restent accessibles.
2. **Serveur** : le layout `(app)`, les pages protégées et les Server Actions appellent
   `requireUser()` / `getCurrentUser()` (`getClaims()` = JWT vérifié, mémorisé par requête).
3. **Base** : RLS sur `profiles`.

### Parcours

| Parcours | Étapes |
| --- | --- |
| Inscription | `/signup` → `signUpAction` (Zod) → `auth.signUp` avec `display_name` et `timezone` en métadonnées → trigger `handle_new_user` crée le profil. Confirmation désactivée : session immédiate → `/today`. Activée : écran « Vérifie tes courriels » → lien → `/auth/callback` → `/today`. |
| Connexion | `/login?next=...` → `signInAction` → `auth.signInWithPassword` → `getSafeRedirect(next)`. Message générique en cas d'échec. |
| Mot de passe oublié | `/forgot-password` → `auth.resetPasswordForEmail` (retour : `/auth/callback?next=/reset-password`) → message identique que le compte existe ou non. |
| Réinitialisation | lien → `/auth/callback` (session de récupération) → `/reset-password` → `auth.updateUser({ password })` → « Ton mot de passe a été mis à jour. » → accès à l'espace. Sans session : écran « Lien expiré ». |
| Déconnexion | menu utilisateur ou bouton → `signOutAction` → `/login`. |

### Callback `/auth/callback`

Accepte `?code=` (PKCE, `exchangeCodeForSession`) et `?token_hash=&type=` (`verifyOtp`).
`next` est validé par `getSafeRedirect` (`recovery` → `/reset-password` par défaut). Échec →
`/login?error=link_invalid` (code connu, jamais de texte arbitraire dans l'URL).
Les URL de retour sont construites depuis `NEXT_PUBLIC_SITE_URL` ; configuration Supabase :
[SUPABASE_SETUP.md](./SUPABASE_SETUP.md).

### Profil courant

`getCurrentProfile()` (`src/lib/services/profiles.ts`) lit le profil de l'utilisateur connecté,
mémorisé par requête. Pas de Context React global : les données serveur sont passées en props.
`TimezoneSync` enregistre le fuseau du navigateur si le profil n'en a pas (ADR-019).

### Formulaires

- Server Actions + `useActionState` ; état `idle | success | error` (`src/lib/forms.ts`),
  `pending` fourni par React (bouton désactivé, indicateur de chargement).
- Validation client **et** serveur avec le même schéma Zod (`useClientValidation` bloque la
  soumission invalide et place le focus sur le premier champ en erreur).
- Accessibilité : `FormField` relie libellé, aide et erreur (`aria-invalid`, `aria-describedby`) ;
  message global `role="alert"` / `role="status"` ; `autocomplete` adapté ; mot de passe
  affichable / masquable.
- Journalisation : codes d'erreur techniques uniquement (jamais courriel, mot de passe, jeton,
  cookie ni contenu du profil).

## Conventions de composants

- Fichiers en `kebab-case.tsx`, composants en `PascalCase`, exports nommés (sauf fichiers
  spéciaux Next : `page`, `layout`, `error`, ...).
- Un composant = une responsabilité. Pas de gros composants multi-fonctionnalités.
- Styles uniquement via les **tokens** (`bg-primary`, `text-muted-foreground`,
  `bg-status-sober-soft`, ...). Aucune couleur codée en dur.
- Composants shadcn/ui : ajoutés à la demande avec `npx shadcn@latest add <composant>`.
  Leur code nous appartient ; les tailles de `Button` ont été agrandies pour le tactile
  (`default` 40 px, `lg` 48 px).
- Textes d'interface en français ; valeurs techniques (enums, colonnes) en anglais.
- Toute information d'état : **texte + icône + couleur** (voir `src/config/day-status.ts`).

## Design system

- Palette naturelle : crème / blanc cassé (fond), vert forêt doux (`primary`), vert sauge
  (`secondary`, `accent`), gris chaud (`muted`, `border`), charcoal (`foreground`).
  Rouge doux réservé à `destructive` et à l'état `consumed`.
- Tokens au format shadcn dans `src/app/globals.css` (`:root` + `.dark` préparé, non activé).
- Tokens d'état de journée : `status-{sober|challenging|consumed|untracked}` avec
  variantes `-soft` et `-foreground`.
- Rayon de base `0.875rem` (coins arrondis généreux).
- Typographie : **Figtree** (une seule famille) via `next/font/google`, auto-hébergée au build,
  sous-ensembles `latin` + `latin-ext`.
- `prefers-reduced-motion` respecté globalement.

## Stratégie de données

- PostgreSQL via Supabase, schéma versionné par migrations SQL (voir [DATABASE.md](./DATABASE.md)).
- RLS obligatoire sur toute table de données utilisateur.
- Journée locale (`date`) séparée des horodatages (`timestamptz` UTC).
- On **calcule** plutôt que stocker les valeurs dérivées (séries, statistiques, accomplissements).
- Chargements ciblés : pas de données détaillées d'une année entière quand un agrégat suffit.

## Stratégie de validation

- **Zod** est la source unique des règles de validation, partagées client/serveur.
- Côté serveur : toute entrée (Server Action, Route Handler) est validée avant d'atteindre la base.
- En base : contraintes `CHECK`, `NOT NULL`, `UNIQUE` en dernière ligne de défense.
- Variables d'environnement : `src/lib/env.ts`, validation **paresseuse** (au premier usage)
  pour qu'un build de pages publiques ne dépende pas des clés Supabase, avec un message
  d'erreur explicite si une variable manque.

## Tests

- Vitest (`npm test`), fichiers `*.test.ts` colocalisés avec le code testé.
- Sprint 0 : validation des variables d'environnement.
- Sprint 1 : redirections sûres, accès proxy, schémas d'authentification, messages d'erreur, fuseaux.
- SQL : `supabase/tests/profiles_rls.sql` (RLS et triggers de `profiles`, voir DATABASE.md).
- Priorité future : séries, statistiques, dates locales/fuseaux, validation, RLS.
- Playwright (tests de parcours) sera ajouté quand les premiers parcours existeront.
