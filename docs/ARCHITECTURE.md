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

Ajoutés plus tard, au sprint qui les utilise : Recharts (Sprint 6), React Hook Form
(Sprint 1 ou 3 selon les formulaires).

## Structure des dossiers

```text
src/
  app/                      Routes (App Router)
    (marketing)/            Pages publiques : accueil, puis confidentialité, conditions
    layout.tsx              Layout racine : police, metadata, providers
    globals.css             Design tokens + Tailwind
    error.tsx               Erreur d'un segment
    global-error.tsx        Erreur du layout racine
    not-found.tsx           404
    loading.tsx             Chargement (Suspense)
    icon.svg                Favicon
  components/
    ui/                     Composants shadcn/ui (code possédé, modifiable)
    layout/                 Structure : SiteHeader/Footer, AppShell, sidebar, nav mobile, PageHeader, PageContainer
    shared/                 Petits composants transverses (BrandMark, StatusMessage)
  config/                   Configuration centralisée : site, routes, navigation, états visuels des journées
  lib/
    env.ts                  Validation des variables d'environnement (Zod)
    supabase/               Clients Supabase navigateur / serveur
    utils.ts                cn()
  types/
    database.ts             Types générés depuis le schéma Supabase
supabase/
  config.toml               Configuration CLI Supabase
  migrations/               Migrations SQL versionnées (créé à la première migration, Sprint 1)
  README.md                 Commandes et règles de migration
docs/                       Documentation projet
```

Les dossiers sont créés **lorsqu'ils contiennent réellement quelque chose**. À venir :

- `src/app/(auth)/` : login, signup, mot de passe oublié (Sprint 1) ;
- `src/app/(app)/` : application authentifiée (`/today`, `/calendar`, `/journal`, `/progress`, `/plan`, `/settings`) ;
- `src/lib/validation/` : schémas Zod métier ;
- `src/lib/services/` : accès aux données ;
- `src/lib/domain/` (ou équivalent) : logique métier pure (séries, statistiques, dates) ;
- `src/components/<domaine>/` : composants par fonctionnalité (`check-in/`, `calendar/`, ...) ;
- `src/hooks/`.

## Route groups

| Groupe | Rôle | Layout |
| --- | --- | --- |
| `(marketing)` | Public. Accueil temporaire au Sprint 0. | `SiteHeader` + `SiteFooter` |
| `(auth)` | Connexion, inscription, réinitialisation (Sprint 1). | Layout centré minimal |
| `(app)` | Application authentifiée. | `AppShell` (sidebar desktop + barre inférieure mobile) |

Un seul layout racine (`src/app/layout.tsx`) : le `not-found` global reste simple.

`AppShell`, `DesktopSidebar`, `MobileNavigation`, `PageHeader` et `PageContainer` existent
déjà dans `src/components/layout/`, mais ne sont montés nulle part : `src/app/(app)/layout.tsx`
sera créé avec la première page authentifiée, derrière la protection d'accès du Sprint 1.
Ainsi, aucune navigation vers des routes inexistantes n'est visible.

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
- `src/lib/supabase/server.ts` : `createServerClient` + `cookies()` de Next.js, un client par requête.
- Les deux utilisent l'**URL du projet** et la **clé publiable** (`sb_publishable_...`),
  validées par `src/lib/env.ts`. La sécurité des données repose sur la **RLS**, pas sur la clé.
- Les clients sont typés avec `Database` (`src/types/database.ts`), régénéré après chaque migration.
- Aucune clé secrète / service role n'est utilisée pour l'instant.

## Authentification prévue (Sprint 1)

- Supabase Auth (courriel + mot de passe), sessions stockées en cookies via `@supabase/ssr`.
- `src/proxy.ts` (convention Next 16, anciennement `middleware.ts`) pour rafraîchir la session
  à chaque navigation et rediriger les routes `(app)` non authentifiées.
- Vérification de l'identité côté serveur avec `supabase.auth.getClaims()` / `getUser()`,
  jamais avec un `user_id` fourni par le client.
- Protection des données par RLS en base, indépendamment du frontend.

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
- Priorité future : séries, statistiques, dates locales/fuseaux, validation, RLS.
- Playwright (tests de parcours) sera ajouté quand les premiers parcours existeront.
