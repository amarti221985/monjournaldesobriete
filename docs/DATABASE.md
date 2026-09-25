# Base de données

> Le schéma est construit progressivement, sprint par sprint.
> Sprint 1 : `profiles`. Sprint 2 : catalogue `substances` et données du parcours. Sprint 3 : check-in quotidien (voir [Schéma actuel](#schéma-actuel)).

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
npm run db:types
```

Configuration complète du projet (dashboard, URLs de redirection, modèles de courriel) :
[SUPABASE_SETUP.md](./SUPABASE_SETUP.md).

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

## Schéma actuel

### Fonctions utilitaires

| Fonction | Rôle |
| --- | --- |
| `public.set_updated_at()` | Trigger `BEFORE UPDATE` réutilisable : `updated_at := clock_timestamp()`. À attacher à toute table possédant `updated_at` (ADR-020). |
| `public.handle_new_user()` | Trigger `AFTER INSERT` sur `auth.users` : crée le profil (ADR-017). `SECURITY DEFINER`, `search_path` vide, exécution révoquée pour `anon` / `authenticated`. |

### `public.profiles` — migration `20260924160000_create_profiles.sql`

| Colonne | Type | Règle |
| --- | --- | --- |
| `id` | `uuid` PK | `references auth.users(id) on delete cascade` |
| `display_name` | `text` null | 2 à 80 caractères, sans espaces en bordure |
| `timezone` | `text` null | Identifiant IANA (`America/Toronto`), forme validée par `CHECK` |
| `onboarding_completed` | `boolean` | `default false` (utilisé au Sprint 2) |
| `created_at` | `timestamptz` | `default now()` (horloge de la base) |
| `updated_at` | `timestamptz` | `default now()`, maintenu par `profiles_set_updated_at` |

- **Index** : aucun en plus de la clé primaire ; tous les accès se font par `id`.
- **Création** : uniquement par le trigger `on_auth_user_created`. Les métadonnées
  d'inscription (`display_name`, `timezone`) sont nettoyées et validées dans le trigger
  (fuseau vérifié contre `pg_timezone_names`) ; une valeur invalide devient `NULL` sans
  bloquer l'inscription.
- **Privilèges** : `anon` aucun ; `authenticated` : `SELECT`, et `UPDATE` limité aux colonnes
  `display_name`, `timezone`, `onboarding_completed`. Aucun `INSERT` ni `DELETE` : le profil
  est créé par le trigger et supprimé en cascade avec le compte.
- **RLS** :
  - `profiles_select_own` : `select` si `(select auth.uid()) = id` ;
  - `profiles_update_own` : `update` si `(select auth.uid()) = id` (using + with check).

### Vérifier la sécurité de `profiles` (utilisateur A vs utilisateur B)

Script automatisé : [`supabase/tests/profiles_rls.sql`](../supabase/tests/profiles_rls.sql).

```bash
npx supabase db query --linked -f supabase/tests/profiles_rls.sql
```

ou Supabase Dashboard → **SQL Editor** → coller le script → **Run**.

Résultat attendu, **affiché comme une erreur (voulu)** :
`RLS_OK — profiles : 14 vérifications réussies (transaction annulée volontairement)`.

Le script est un seul bloc atomique qui se termine toujours par une exception : les deux
utilisateurs fictifs qu'il crée sont **toujours annulés**, quel que soit l'outil d'exécution.
puis vérifie en se faisant passer pour A (`role = authenticated`, `request.jwt.claims.sub = A`) :

- le trigger a créé les deux profils et nettoyé / rejeté les métadonnées;
- A ne voit qu'un profil, ne peut ni lire ni modifier celui de B;
- A peut modifier son profil et `updated_at` est mis à jour par la base;
- A ne peut modifier ni `id` ni `created_at`, ni insérer, ni supprimer un profil;
- un visiteur `anon` n'a aucun accès.

Vérification complémentaire depuis l'application : deux comptes de test fictifs ; avec
la session de A, `supabase.from("profiles").select()` ne retourne que le profil de A, et
`update(...).eq("id", B)` ne modifie aucune ligne.

### Onboarding — migrations `20260925090000_create_onboarding.sql`, `20260925100000_allow_onboarding_draft_upsert.sql`

**Enums** : `substance_goal` (`abstinence` | `reduction` | `observation`) ;
`motivation` (`health`, `energy`, `sleep`, `relationships`, `family`, `confidence`, `finances`,
`career`, `freedom`, `clarity`, `personal_project`, `other`).

| Table | Rôle | Colonnes principales | Contraintes |
| --- | --- | --- | --- |
| `substances` | Catalogue global (lecture seule) | `slug` unique, `name_fr`, `category` (`substance` \| `other`), `is_active`, `sort_order` | format du slug, longueur du nom |
| `user_substances` | Substances suivies | `user_id`, `substance_id`, `custom_name`, `goal`, `started_on date`, `is_primary`, `is_active` | 1 relation active par substance ; 1 principale active ; `custom_name` 1-80 ; `started_on ≥ 1900-01-01` |
| `personal_reasons` | « Pourquoi » | `user_id`, `reason_text` | 1-2000 caractères (hors espaces) |
| `user_motivations` | Motivations | `user_id`, `motivation`, `custom_label` | unique (`user_id`, `motivation`) ; `custom_label` seulement pour `other` |
| `support_contacts` | Personnes de soutien | `user_id`, `name`, `relationship`, `phone`, `email` | nom 1-80 ; relation ≤ 60 ; téléphone souple `[0-9+(). -]{3,32}` ; courriel simple ≤ 254 |
| `onboarding_drafts` | Brouillon du wizard | `user_id` (PK), `current_step` 1-8, `data jsonb` | objet JSON ≤ 16 Ko |

- Toutes les tables utilisateur : `user_id default auth.uid() references auth.users on delete cascade`,
  `created_at` / `updated_at` maintenus par la base (`set_updated_at()` réutilisé).
- **Index** : index uniques partiels ci-dessus + index `user_id` sur `user_substances`,
  `personal_reasons`, `support_contacts` (accès par utilisateur et RLS). Pas d'index sur
  `user_substances.substance_id` : le catalogue compte 6 lignes et n'est jamais supprimé.
- **RLS** : `substances` → `select` des lignes actives pour `authenticated`. Autres tables →
  `select`, `insert`, `update`, `delete` si `(select auth.uid()) = user_id` (using + with check).
  `anon` : aucun privilège. `UPDATE` limité aux colonnes métier (jamais `id`, `created_at`).
- **Garde-fou** : trigger `profiles_ensure_onboarding_requirements` (`BEFORE UPDATE OF
  onboarding_completed`) : refuse le passage à `true` sans substance active (dont une
  principale), raison et motivation (`onboarding_incomplete`).
- **RPC** `complete_onboarding(payload jsonb) returns text` : voir ADR-028. Payload :

```json
{
  "substances": [{ "slug": "cannabis", "goal": "abstinence", "customName": null }],
  "primarySlug": "cannabis",
  "startedOn": "2026-09-24",
  "reason": "…",
  "motivations": ["health", "freedom"],
  "motivationOther": null,
  "supportContact": { "name": "Julie", "relationship": "Amie", "phone": null, "email": null }
}
```

Retour : `completed` ou `already_completed`. Erreurs : `invalid_substances`, `invalid_goal`,
`invalid_primary`, `invalid_started_on`, `invalid_reason`, `invalid_motivations`,
`invalid_support_contact`, `onboarding_incomplete`.

- **Correction Sprint 1** : `authenticated` ne peut plus modifier `profiles.onboarding_completed`.
- **Correctif** (`…100000`) : privilège `UPDATE (user_id)` sur `onboarding_drafts`, requis par
  l'upsert de PostgREST (sans risque : la RLS impose `user_id = auth.uid()`).

### Vérifier la sécurité de l'onboarding

```bash
npx supabase db query --linked -f supabase/tests/onboarding_rls.sql
```

Résultat attendu (affiché comme une erreur, voulu) :
`RLS_OK — onboarding : 24 vérifications réussies`. Couvre : garde-fou, catalogue en lecture
seule, `onboarding_completed` non modifiable, finalisation multi-substance, idempotence,
isolation A/B sur les 4 tables, refus atomiques (sans substance, raison, motivation, date
future, principale invalide), accès anonyme refusé.

### Check-in quotidien — migration `20260926090000_create_daily_checkins.sql`

**Enum** `checkin_status` : `sober` | `sober_with_craving` | `consumed`.

| Table | Rôle | Points clés |
| --- | --- | --- |
| `emotions`, `trigger_types`, `achievement_types` | Catalogues (lecture seule) | slug stable, `name_fr`, `sort_order`, `is_active` ; `emotions.category` = `positive` \| `difficult` |
| `daily_checkins` | Check-in d'une journée locale | `checkin_date date` ; `UNIQUE (user_id, checkin_date)` ; scores `mood`/`energy`/`stress` 1-10, `craving` 0-10 (`CHECK`) ; textes ≤ 1000 / 2000 / 2000 / 1000 / 5000 ; `completed_at` (NULL = brouillon) ; terminé ⇒ 4 scores |
| `checkin_emotions` | Émotions du check-in | PK (`checkin_id`, `emotion_id`) |
| `checkin_triggers` | Déclencheurs | PK (`checkin_id`, `trigger_type_id`), `custom_label` ≤ 80 |
| `checkin_achievements` | Accomplissements | PK (`checkin_id`, `achievement_type_id`), `custom_label` ≤ 80 |
| `consumption_events` | Consommations | `user_substance_id`, `quantity numeric(10,2)` (0 < q ≤ 10000), `unit` ≤ 40, `occurred_at time`, `craving_before` 0-10, textes ≤ 2000 |

- **Intégrité (ADR-036)** : `user_id` sur chaque relation + clés étrangères composites vers
  `daily_checkins (id, user_id)` (cascade) et `user_substances (id, user_id)` (pas de cascade).
  Ajout de `UNIQUE (id, user_id)` sur `user_substances`.
- **Cohérence (ADR-037)** : triggers de contrainte différés `daily_checkins_consumption_consistency`
  et `consumption_events_consistency` → `checkin_consumption_inconsistent`.
- **Index** : unicité (`user_id`, `checkin_date`) ; `user_id` sur les relations ;
  `consumption_events (checkin_id)`, `(user_substance_id)`.
- **RPC** `save_checkin(payload jsonb, finalize boolean default false) returns jsonb` :
  `SECURITY INVOKER`. Payload :

```json
{
  "checkinDate": "2026-09-24",
  "status": "consumed",
  "moodScore": 6, "energyScore": 5, "stressScore": 7, "cravingScore": 8,
  "emotions": ["stress", "fatigue"],
  "triggers": [{ "slug": "other", "customLabel": "…" }],
  "achievements": [{ "slug": "exercise" }],
  "victoryText": "…", "proudOfText": null, "lessonText": null,
  "tomorrowIntentionText": null, "notes": null,
  "consumptionEvents": [
    { "userSubstanceId": "uuid", "quantity": 1.5, "unit": "joint", "occurredAt": "21:30",
      "cravingBefore": 7, "contextText": "…", "reflectionText": null, "nextTimeStrategyText": null }
  ]
}
```

Retour : `{ id, checkinDate, completed }`. Erreurs : `invalid_checkin_date`, `invalid_values`,
`invalid_status`, `missing_scores`, `invalid_emotions`, `invalid_triggers`,
`invalid_achievements`, `invalid_consumption_events`, `consumption_events_not_allowed`,
`consumption_event_required`, `checkin_already_completed`.

- **RLS** : catalogues → `select` des lignes actives. `daily_checkins` → `select`, `insert`,
  `update` de ses lignes ; `delete` **des brouillons seulement**. Relations → `select`,
  `insert`, `delete` de ses lignes (+ `update` pour `consumption_events`). `anon` : aucun accès.
  `UPDATE` limité aux colonnes métier.

### Vérifier le check-in

```bash
npx supabase db query --linked -f supabase/tests/checkins_rls.sql
```

Résultat attendu : `RLS_OK — checkins : 26 vérifications réussies`. Couvre : catalogues en
lecture seule, brouillon, scores exigés, finalisation, idempotence, précision « other »,
brouillon qui n'écrase pas un terminé, unicité par journée, date future, `consumed` sans
événement, `sober` avec événement, `sober → consumed` (une substance sur deux, deux
événements), `consumed → sober` (sans orphelin), cohérence hors RPC, substance d'un autre
utilisateur (RPC et clé composite), suppression interdite d'un terminé et permise d'un
brouillon, score hors limite, isolation A/B sur les 5 tables.

### Statistiques (Sprint 4) — aucune migration

Aucune table ni colonne ajoutée : les métriques sont **calculées** à partir des check-ins
terminés (ADR-041, ADR-046). Requête de lecture :

```text
daily_checkins (checkin_date, status, mood_score, energy_score, stress_score, craving_score)
  + checkin_triggers → trigger_types.slug
  + checkin_achievements → achievement_types.slug
WHERE user_id = <utilisateur> AND completed_at IS NOT NULL   (RLS en plus)
ORDER BY checkin_date
```

Couverte par l'index unique (`user_id`, `checkin_date`). Les brouillons et les textes personnels
ne sont jamais lus par les statistiques.

### Progression (Sprint 6) — aucune migration

Aucune table, colonne, fonction ni index ajouté ; aucune table d'agrégats (ADR-053). Une requête
relationnelle (`getProgressDataset`), partagée avec le tableau de bord :

```text
daily_checkins (checkin_date, status, mood_score, energy_score, stress_score, craving_score)
  + checkin_triggers → trigger_types (slug, name_fr)
  + checkin_achievements → achievement_types (slug, name_fr)
  + checkin_emotions → emotions (slug, name_fr)
  + consumption_events (user_substance_id) → user_substances (custom_name) → substances (name_fr)
WHERE user_id = <session> AND completed_at IS NOT NULL   (RLS sur chaque table)
ORDER BY checkin_date
```

- **Index** : l'index unique (`user_id`, `checkin_date`) couvre le filtre ; les relations sont
  résolues par `checkin_id` (clés primaires composites / `consumption_events_checkin_id_idx`). Pas
  d'index de plage supplémentaire : le volume par utilisateur reste de quelques centaines de lignes.
- **Jamais lus** : textes de réflexion, notes, contexte / réflexion / stratégie des consommations,
  précisions « Autre » des déclencheurs et accomplissements, quantités et unités.
- **Isolation** : aucun `user_id` venant du navigateur ; la RLS existante (Sprint 3) s'applique à
  chaque table jointe (vérifiée par `checkins_rls.sql` et le test d'intégration Sprint 6).

### Journal — migration `20260927090000_create_journal_search.sql`

`search_journal(p_status checkin_status, p_from date, p_before date, p_query text, p_limit int)
returns setof daily_checkins` — `SECURITY INVOKER`, `STABLE` (ADR-049, ADR-050) :

- check-ins **terminés** de `auth.uid()` seulement (RLS en plus), `ORDER BY checkin_date DESC` ;
- `p_status` (statut), `p_from` (première journée incluse), `p_before` (curseur exclusif) ;
- `p_query` : `ILIKE` sur les 5 champs de réflexion, `%`, `_` et `\` échappés, 100 caractères max ;
- `p_limit` borné à 51 (l'application demande 21 : 20 affichées + 1 pour « Afficher plus »).

Appelée avec un `select` imbriqué (émotions, déclencheurs) pour les aperçus. Aucun index ajouté :
l'index unique (`user_id`, `checkin_date`) suffit (parcours arrière pour l'ordre décroissant).

**Calendrier** : lecture de `checkin_date`, `status`, `completed_at` sur la période affichée,
sans migration. Dates métier manipulées comme chaînes `YYYY-MM-DD` de bout en bout (jamais
converties en timestamp ; `src/lib/dates.ts`).

### Vérifier le journal

```bash
npx supabase db query --linked -f supabase/tests/journal_rls.sql
```

Résultat attendu : `RLS_OK — journal : 14 vérifications réussies` (pagination, brouillons exclus,
recherche, casse, combinaison recherche + statut + période, jokers littéraux, taille de page,
isolation A/B, lecture d'une date d'un autre compte).

## Grandes entités envisagées

Conçues sprint par sprint (noms indicatifs, susceptibles d'évoluer) :

| Entité | Sprint | Rôle |
| --- | --- | --- |
| `profiles` | 1 ✅ | Profil (nom d'affichage, fuseau horaire, onboarding) |
| `substances` | 2 ✅ | Catalogue global contrôlé (« Autre » précisé par l'utilisateur) |
| `user_substances` | 2 ✅ | Substances suivies, objectif (arrêter / réduire / observer), date de début |
| `personal_reasons`, `user_motivations`, `support_contacts` | 2 ✅ | Pourquoi, motivations, soutien |
| `onboarding_drafts` | 2 ✅ | Brouillon du wizard (supprimé à la finalisation) |
| `personal_goals` | 8 | Objectifs personnels (Mon plan) |
| `daily_checkins` | 3 ✅ | Check-in global du jour (humeur, énergie, stress, envie, réflexions) |
| `emotions`, `trigger_types`, `achievement_types` | 3 ✅ | Catalogues contrôlés du check-in |
| `checkin_emotions`, `checkin_triggers`, `checkin_achievements` | 3 ✅ | Détails du check-in |
| `consumption_events` | 3 ✅ | Consommations par substance suivie (ADR-037) |
| `craving_events`, `craving_strategies`, `craving_interventions` | 7 | Mode envie forte et timer |
| `journal_entries` | 5 | Réflexions libres |
| `user_milestones` | 9 | Seulement si un stockage est justifié (sinon calculé) |
| `notification_preferences` | 10 | Rappels |

Échelles de scores prévues : `mood_score`, `energy_score`, `stress_score` 1-10 ;
`craving_score` 0-10. Validées par Zod **et** par des contraintes `CHECK`.

## Données de démonstration

Les seeds (`supabase/seed.sql`) contiendront uniquement des données **fictives**, jamais
d'informations personnelles ou médicales réelles.
