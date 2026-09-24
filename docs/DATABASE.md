# Base de données

> Sprint 0 : **aucune table métier n'existe encore.** Ce document fixe les principes ;
> le schéma sera conçu progressivement dans les sprints concernés.

## Plateforme

- **PostgreSQL** hébergé par **Supabase** (projet cloud, région Canada (Central)).
- Authentification par **Supabase Auth** (schéma `auth`, géré par Supabase).
- Données applicatives dans le schéma `public`.

## Migrations versionnées

Toute modification du schéma passe par un fichier SQL dans `supabase/migrations/`.
**Aucune modification manuelle dans le dashboard Supabase** sans migration correspondante.

```bash
# Créer une migration (fichier horodaté vide)
npx supabase migration new <nom_descriptif>

# Lier le projet local au projet Supabase cloud (une seule fois)
npx supabase login
npx supabase link --project-ref <project-ref>

# Appliquer les migrations en attente sur le projet lié
npx supabase db push

# Régénérer les types TypeScript après une migration
npx supabase gen types typescript --linked > src/types/database.ts
```

Conventions :

- Nom : `YYYYMMDDHHMMSS_description_en_snake_case.sql` (généré par la CLI).
- Une migration = un changement cohérent. Ne jamais modifier une migration déjà appliquée
  en production : en créer une nouvelle.
- Chaque migration qui crée une table de données utilisateur **active la RLS et crée ses
  politiques dans le même fichier**.
- Les commandes ci-dessus ne nécessitent **pas Docker**. Docker n'est requis que pour
  un Supabase local (`supabase start`) ou `supabase db diff`, non utilisés pour l'instant.

## RLS obligatoire

- `alter table ... enable row level security;` sur **toute** table contenant des données
  utilisateur, sans exception.
- Politiques explicites par opération (`select`, `insert`, `update`, `delete`), basées sur
  `(select auth.uid()) = user_id`.
- Tables de référence partagées (ex. catalogue de substances par défaut) : lecture pour les
  utilisateurs authentifiés, écriture réservée aux migrations.
- La clé publiable est exposée au navigateur **par conception** : la RLS est la vraie barrière.
- La clé secrète / service role contourne la RLS : usage exclusivement serveur, limité aux
  opérations administratives justifiées (ex. suppression de compte, Sprint 11).

## Propriété des données (user ownership)

- Chaque ligne de donnée personnelle porte un `user_id uuid not null references auth.users(id) on delete cascade`.
- Le `user_id` est déterminé **côté serveur** depuis la session (`auth.uid()` en base,
  `getClaims()` / `getUser()` côté Next.js), jamais accepté tel quel depuis le client.
  Par défaut : `user_id uuid not null default auth.uid()`.
- `on delete cascade` depuis `auth.users` garantit que la suppression du compte supprime
  toutes les données associées.

## Dates locales et timestamps UTC

Principe central (voir ADR-006) :

| Concept | Type | Exemple |
| --- | --- | --- |
| Journée vécue par l'utilisateur | `date` (`local_date`) | `2026-09-24` |
| Instant technique | `timestamptz` (stocké UTC) | `created_at`, `updated_at`, `occurred_at` |
| Fuseau de l'utilisateur | `text` IANA dans le profil | `America/Toronto` |

- Un check-in est rattaché à une **journée locale** (`local_date`), calculée dans le fuseau
  de l'utilisateur au moment de la saisie, puis figée. Un check-in fait à 23 h reste sur la
  bonne journée.
- Unicité : `unique (user_id, local_date)` pour le check-in principal.
- Les statistiques par journée se calculent sur `local_date`, jamais sur `created_at::date`.
- Les horodatages restent en UTC pour l'audit et l'ordre chronologique.

## Grandes entités envisagées

Conçues sprint par sprint (noms indicatifs, susceptibles d'évoluer) :

| Entité | Sprint | Rôle |
| --- | --- | --- |
| `profiles` | 1 | Profil (nom d'affichage, fuseau horaire, préférences) |
| `substances` | 2 | Catalogue (par défaut + personnalisées) |
| `user_substances` | 2 | Substances suivies, objectif (arrêter / réduire / observer), date de début |
| `personal_reasons`, `personal_goals`, `support_contacts` | 2 / 8 | Pourquoi, motivations, soutien, plan |
| `daily_checkins` | 3 | Check-in global du jour (humeur, énergie, stress, envie, réflexions) |
| `checkin_substance_statuses` | 3 | Statut du jour **par substance suivie** (voir ADR-007) |
| `checkin_emotions`, `checkin_triggers`, `checkin_achievements` | 3 | Détails du check-in |
| `consumption_events` | 3 | Détails d'une consommation |
| `craving_events`, `craving_strategies`, `craving_interventions` | 7 | Mode envie forte et timer |
| `journal_entries` | 5 | Réflexions libres |
| `user_milestones` | 9 | Seulement si un stockage est justifié (sinon calculé) |
| `notification_preferences` | 10 | Rappels |

Échelles de scores prévues : `mood_score`, `energy_score`, `stress_score` 1-10 ;
`craving_score` 0-10. Validées par Zod **et** par des contraintes `CHECK`.

## Données de démonstration

Les seeds (`supabase/seed.sql`) contiendront uniquement des données **fictives**, jamais
d'informations personnelles ou médicales réelles.
