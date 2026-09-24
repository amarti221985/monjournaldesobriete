# Mon Journal de Sobriété

> Un jour à la fois. Comprendre ses habitudes. Reconnaître ses progrès. Construire sa sobriété.

Webapp de journal de sobriété : check-in quotidien, suivi des envies et déclencheurs,
réflexions, visualisation de la progression. Outil de journalisation et de suivi personnel —
il ne remplace pas les conseils ou soins d'un professionnel de la santé.

État : **Sprint 0 — fondations techniques** (voir [docs/PROJECT.md](docs/PROJECT.md)).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS 4 · shadcn/ui (Radix) ·
Lucide · Zod · Supabase (Auth + PostgreSQL + RLS) · Vitest.

## Prérequis

- **Node.js 24 LTS** recommandé (voir `.nvmrc`) — minimum 20.9 (exigence de Next.js 16).
- **npm** (seul gestionnaire de paquets du projet ; ne pas utiliser pnpm/yarn/bun).
- Un projet **Supabase** (cloud). Docker n'est **pas** nécessaire.

## Installation

```bash
npm install
```

## Variables d'environnement

Copier le modèle puis renseigner les valeurs :

```bash
cp .env.example .env.local
```

| Variable | Requise | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Oui* | URL du projet Supabase (`https://<ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Oui* | Clé publiable Supabase (`sb_publishable_...`) |
| `NEXT_PUBLIC_SITE_URL` | Non | URL publique de l'app (défaut `http://localhost:3000`) |

\* Validées au premier usage d'un client Supabase (`src/lib/env.ts`) : la page d'accueil
fonctionne sans elles, mais toute fonctionnalité Supabase affichera une erreur explicite si
elles manquent.

Où les trouver : Dashboard Supabase → **Project Settings → API Keys** (clé publiable) et
**Data API** (URL).

`.env.local` est ignoré par Git. **Ne jamais** commiter de clé, ni exposer une clé secrète
(`sb_secret_...` / `service_role`) avec le préfixe `NEXT_PUBLIC_`.

## Développement local

```bash
npm run dev
```

Puis ouvrir <http://localhost:3000>.

| Script | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement (Turbopack) |
| `npm run typecheck` | Génère les types de routes puis `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Tests unitaires (Vitest) |
| `npm run build` | Build de production |
| `npm start` | Démarre le build de production |
| `npm run check` | Typecheck + lint + tests + build |

## Supabase

Stratégie : projet **cloud** (région Canada (Central)), schéma versionné dans
`supabase/migrations/`, appliqué avec la CLI via `npx` (sans Docker).

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase migration new <nom>        # créer une migration
npx supabase db push                    # appliquer les migrations
npx supabase gen types typescript --linked > src/types/database.ts
```

Détails et conventions : [docs/DATABASE.md](docs/DATABASE.md).

## Build

```bash
npm run build
npm start
```

## Déploiement (Hostinger Business — Node.js Web App)

1. Connecter le dépôt GitHub dans hPanel → **Websites → Node.js Web App**.
2. Version de Node : **24** (sinon 22).
3. Commande d'installation : `npm ci` · build : `npm run build` · démarrage : `npm start`.
4. Définir les variables d'environnement dans hPanel (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL=https://ton-domaine`).
   Les variables `NEXT_PUBLIC_*` sont intégrées **au moment du build** : redéployer après
   les avoir modifiées.
5. HTTPS activé sur le domaine.

Aucune dépendance à Vercel : l'app est un serveur Node standard.

## Documentation

- [docs/PROJECT.md](docs/PROJECT.md) — vision, philosophie, roadmap, principes UX
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — structure, conventions, stratégie technique
- [docs/DATABASE.md](docs/DATABASE.md) — principes de base de données, migrations, RLS, dates
- [docs/DECISIONS.md](docs/DECISIONS.md) — journal des décisions d'architecture (ADR)
- [docs/MASTER_PROMPT.md](docs/MASTER_PROMPT.md) — cahier des charges maître
