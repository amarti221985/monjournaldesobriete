# Mon Journal de Sobriété

> Un jour à la fois. Comprendre ses habitudes. Reconnaître ses progrès. Construire sa sobriété.

Webapp de journal de sobriété : check-in quotidien, suivi des envies et déclencheurs,
réflexions, visualisation de la progression. Outil de journalisation et de suivi personnel —
il ne remplace pas les conseils ou soins d'un professionnel de la santé.

État : **Sprint 13 — préparation de la bêta V1** (Sprint 10 reporté ; voir [docs/BETA_CHECKLIST.md](docs/BETA_CHECKLIST.md)) (voir [docs/PROJECT.md](docs/PROJECT.md)).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS 4 · shadcn/ui (Radix) ·
Lucide · Zod · Recharts · Supabase (Auth + PostgreSQL + RLS) · Vitest.

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
| `NEXT_PUBLIC_SITE_URL` | En production | URL publique de l'app (défaut `http://localhost:3000`). Sert à construire les liens des courriels d'authentification. |
| `ANTHROPIC_API_KEY` | Non | Clé **serveur** du fournisseur d'IA. Sans elle, les bilans intelligents sont indisponibles et rien n'est envoyé. Jamais `NEXT_PUBLIC_`. |
| `AI_MODEL` | Non | Modèle utilisé pour les bilans (défaut `claude-opus-5`). |

\* Validées au premier usage d'un client Supabase (`src/lib/env.ts`) : le build et la page
d'accueil fonctionnent sans elles, mais l'authentification et l'espace personnel affichent
une erreur explicite si elles manquent.

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
| `npm run db:types` | Régénère `src/types/database.ts` depuis le projet Supabase lié |

## Supabase

Stratégie : projet **cloud** (région Canada (Central)), schéma versionné dans
`supabase/migrations/`, appliqué avec la CLI via `npx` (sans Docker).

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase migration new <nom>        # créer une migration
npx supabase db push                    # appliquer les migrations
npm run db:types                        # régénérer les types
```

Configuration du projet (URLs de redirection, confirmation du courriel, modèles de courriel,
vérification RLS) : [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md).

Tests de sécurité SQL (transaction toujours annulée, aucune donnée conservée) :

```bash
npx supabase db query --linked -f supabase/tests/profiles_rls.sql
npx supabase db query --linked -f supabase/tests/onboarding_rls.sql
npx supabase db query --linked -f supabase/tests/checkins_rls.sql
npx supabase db query --linked -f supabase/tests/journal_rls.sql
npx supabase db query --linked -f supabase/tests/craving_rls.sql
npx supabase db query --linked -f supabase/tests/plan_rls.sql
npx supabase db query --linked -f supabase/tests/achievements_rls.sql
npx supabase db query --linked -f supabase/tests/security_rls.sql
```
Schéma et conventions : [docs/DATABASE.md](docs/DATABASE.md).

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
   les avoir modifiées. Si l'hébergeur ne les fournit qu'au démarrage, le serveur les relit
   à l'exécution (`src/lib/env.ts`).
5. Dans Supabase, ajouter `https://ton-domaine/auth/callback` aux Redirect URLs et régler
   la Site URL (voir [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md)).
6. HTTPS activé sur le domaine.

Aucune dépendance à Vercel : l'app est un serveur Node standard.

## Documentation

- [docs/PROJECT.md](docs/PROJECT.md) — vision, philosophie, roadmap, principes UX
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — structure, conventions, stratégie technique
- [docs/DATABASE.md](docs/DATABASE.md) — principes de base de données, migrations, RLS, dates
- [docs/DECISIONS.md](docs/DECISIONS.md) — journal des décisions d'architecture (ADR)
- [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) — configuration Supabase (Auth, URLs, courriels)
- [docs/SECURITY.md](docs/SECURITY.md) / [docs/PRIVACY.md](docs/PRIVACY.md) — sécurité, carte des données
- [docs/AI.md](docs/AI.md) — bilans intelligents (consentement, minimisation, garde-fous)
- [docs/PDF_EXPORT.md](docs/PDF_EXPORT.md) — rapport PDF
- [docs/BETA_CHECKLIST.md](docs/BETA_CHECKLIST.md), [docs/BETA_ISSUES.md](docs/BETA_ISSUES.md), [docs/BETA_TEST_PLAN.md](docs/BETA_TEST_PLAN.md) — bêta V1
- [docs/MASTER_PROMPT.md](docs/MASTER_PROMPT.md) — cahier des charges maître
