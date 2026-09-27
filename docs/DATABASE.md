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

### Sécurité — migration `20261001090000_security_hardening.sql`

- `set_updated_at()` : exécution retirée à `anon` / `authenticated` ; `user_substances` : plus de
  `DELETE` ni d'`UPDATE (substance_id)` depuis l'application (désactivation seulement).
- Triggers d'invariants : `enforce_no_future_business_date` (`daily_checkins.checkin_date`,
  `craving_events.local_date`, `user_substances.started_on`, via `latest_allowed_local_date()`),
  `enforce_max_active_substances` (6), `enforce_valid_timezone` (`pg_timezone_names`).
- Clés `consumption_events` / `craving_event_substances` → `user_substances (id, user_id)`
  **DEFERRABLE INITIALLY DEFERRED**.
- `delete_my_account()` : SECURITY DEFINER, sans paramètre, supprime `auth.users` pour
  `auth.uid()`.

### Propriété, RLS et suppression (état audité)

| Table | Propriétaire | Parent / clé | À la suppression du compte |
| --- | --- | --- | --- |
| `profiles` | `id` | `auth.users` | CASCADE |
| `user_substances`, `personal_reasons`, `user_motivations`, `support_contacts`, `onboarding_drafts`, `daily_checkins`, `craving_events`, `user_personal_triggers`, `user_personal_strategies`, `safe_places`, `personal_reminders`, `self_letters`, `user_achievements` | `user_id` | `auth.users` | CASCADE |
| `checkin_emotions`, `checkin_triggers`, `checkin_achievements`, `consumption_events` | `user_id` | `daily_checkins (id, user_id)` | CASCADE via le check-in |
| `craving_event_substances`, `craving_event_emotions`, `craving_event_triggers`, `craving_interventions` | `user_id` | `craving_events (id, user_id)` | CASCADE via le moment |
| références vers `user_substances` (`consumption_events`, `craving_event_substances`) | — | `(user_substance_id, user_id)` | NO ACTION **différée** (supprimées par les cascades avant le commit) |
| références vers les catalogues | — | `emotions`, `trigger_types`, … | NO ACTION (catalogues jamais supprimés) |

RLS activée sur les 32 tables (dont `ai_generation_reservations`, sans aucun droit client) ; policies `(select auth.uid()) = user_id` (ou `id`) par opération
accordée ; catalogues en lecture seule ; `user_achievements` en lecture seule.

### Vérifier la sécurité

```bash
npx supabase db query --linked -f supabase/tests/security_rls.sql
```

Résultat attendu : `RLS_OK — security : 16 vérifications réussies` (jeu complet sur 25 tables ;
lecture, modification, suppression et insertion croisées refusées ; références croisées ; RPC avec
UUID devinés ; affectation de masse ; dates futures ; 7e substance ; fuseau ; droits des fonctions ;
suppression non authentifiée refusée ; suppression de A : 0 ligne restante, B intact).

### Avis bêta — migration `20261005090000_create_beta_feedback.sql`

| Table | Rôle | Droits du client |
| --- | --- | --- |
| `beta_feedback` | `user_id` → `auth.users` CASCADE, `category` (bug, confusing, suggestion, like), `message` (1–2000), `page_context` (liste fermée de sections ou NULL), `created_at` | select ; insert (user_id, category, message, page_context) |

RLS propriétaire, aucune modification ni suppression par le client ; déclencheur
`enforce_beta_feedback_rate` (20 avis / 24 h). Test : `supabase/tests/beta_feedback_rls.sql`
(`RLS_OK — beta_feedback : 10 vérifications réussies`).

### Bilans intelligents — migration `20261002090000_create_ai_insights.sql`

| Table | Rôle | Droits du client |
| --- | --- | --- |
| `ai_preferences` | Une ligne par utilisateur (PK `user_id` → `auth.users` CASCADE) : `ai_enabled` (défaut false), catégories (`include_reflections` true, `include_consumption_context` / `include_craving_context` false), `consented_at`, `consent_version`, `revoked_at`, `last_generation_at` (fenêtre de 24 h) | select ; insert / update des préférences seulement (jamais `last_generation_at`) |
| `ai_reflections` | Bilans validés : `period_start`, `period_end` (≤ 31 j), `type` 'weekly', `summary` (≤ 1200), `content` jsonb objet (≤ 32 Ko), `provider`, `model`, `prompt_version`, `generated_at` ; unique `(user_id, type, period_start, period_end)` | select, delete |

Contrainte : `ai_enabled` exige `consented_at` et `consent_version`. RPC SECURITY DEFINER sans
paramètre d'utilisateur (`auth.uid()`, `search_path = ''`) : `reserve_ai_generation()`
(consentement actif, un bilan par 24 heures glissantes ; erreurs `ai_consent_required`,
`ai_rate_limited`) et `save_ai_reflection(...)` (consentement actif, upsert par période).
Jamais de prompt, de jeu de données ni de réponse brute en base.

Migration `20261003090000_ai_generation_release.sql` : `reserve_ai_generation()` renvoie
`(remaining, reservation)` ; `release_ai_generation(p_reservation uuid)` rend l'essai (même jour
une seule fois) si le jeton correspond. Migration `20261004090000_ai_generation_cooldown.sql` : un bilan par 24 heures glissantes
(`last_generation_at`, repris du dernier bilan existant) ; l'ancien compteur quotidien est supprimé ;
une libération restaure la date précédente. Table interne `ai_generation_reservations` (PK
`user_id` → `auth.users` CASCADE, RLS sans policy, aucun droit client).

### Vérifier les bilans intelligents

```bash
npx supabase db query --linked -f supabase/tests/ai_rls.sql
```

Résultat attendu : `RLS_OK — ai : 24 vérifications réussies` (libération : mauvais jeton refusé,
bon jeton une seule fois, jetons illisibles par les clients ; consentement requis, activation sans
consentement refusée, date de génération non modifiable, 2e bilan refusé dans les 24 h (et à 23 h), accepté après 24 h,
écriture directe refusée, régénération qui remplace, contraintes de forme, isolation A/B, RPC non
exécutables par `anon`, désactivation qui conserve les bilans, suppression en cascade).

### Accomplissements — migration `20260930090000_create_achievements.sql`

| Objet | Rôle |
| --- | --- |
| `achievement_category` | `sobriety`, `consistency`, `reflection`, `understanding`, `action`, `plan` |
| `achievement_definitions` | catalogue stable (51 jalons seedés, `ON CONFLICT (slug) DO NOTHING`) : `slug` unique, `category`, `metric`, `threshold` ≥ 1, `is_quantitative`, `name_fr`, `description_fr`, `icon_key` (clé Lucide), `sort_order`, `is_active` ; `unique (metric, threshold)` |
| `user_achievements` | obtenus (événements historiques) : `earned_at`, `metadata` `{ metric, threshold, date_source }`, `unique (user_id, achievement_definition_id)` ; index `(user_id, earned_at DESC)` |

Métriques (`achievement_metric_events`, calculées à la volée) : `checkins`, `sober_days`,
`best_streak`, `reflection_days` (au moins un champ de réflexion non vide, espaces exclus),
`victory_days`, `trigger_days` / `emotion_days` (journées), `craving_interventions` (moments
`completed`), `strategies_tried` (distinctes), `plan_reason`, `plan_motivations`,
`plan_triggers`, `plan_strategies`, `plan_support`, `plan_safe_places`, `plan_reminder`,
`plan_letter`, `plan_elements` (8 éléments possibles).

**RPC** : `award_achievements()` (SECURITY DEFINER sans paramètre, `authenticated`) →
`{ awarded: [{ slug, earnedAt }], initial }` ; `get_achievement_progress()` (SECURITY DEFINER,
valeurs de l'utilisateur courant). Internes, sans droit d'exécution pour l'application :
`achievement_metric_events(user_id)`, `award_achievements_for(user_id)`.

**RLS** : catalogue — lecture des jalons actifs ; `user_achievements` — lecture de ses lignes
seulement, aucune écriture depuis l'application.

### Vérifier les accomplissements

```bash
npx supabase db query --linked -f supabase/tests/achievements_rls.sql
```

Résultat attendu : `RLS_OK — achievements : 24 vérifications réussies` (métriques, rattrapage
45 sobres / 52 check-ins / 12 réflexions / 4 interventions, séries, journées avec déclencheur,
8 → 9 compté, en cours exclu, stratégies distinctes, dates exact / attribution, métadonnées,
idempotence ×10, consommation qui ne retire rien, plan persistant, aucune auto-attribution,
fonctions internes fermées, isolation A / B).

### Mon plan — migration `20260929090000_create_personal_plan.sql`

Réutilise `user_substances`, `personal_reasons`, `user_motivations` et `support_contacts`.

| Objet | Rôle |
| --- | --- |
| `support_contacts.is_primary` | personne principale ; index unique partiel (une par utilisateur) |
| `user_personal_triggers` | `trigger_type_id` (catalogue) XOR `custom_label` (1–80), `notes` ≤ 1000, `is_active` ; un déclencheur du catalogue une fois (index unique partiel) |
| `user_personal_strategies` | `strategy_id` (catalogue Sprint 7) XOR `custom_name` (1–120), `notes` ≤ 1000, `default_duration_minutes` ∈ {5, 10, 15, 20}, `is_favorite`, `is_active` ; une stratégie du catalogue une fois |
| `safe_places` | `name` (1–80), `description` ≤ 300, `is_favorite`, `is_active` — aucune adresse ni coordonnée |
| `personal_reminders` | un par utilisateur (`unique (user_id)`), `content` 1–1000 |
| `self_letters` | une par utilisateur, `title` ≤ 120 facultatif, `content` 1–5000 |
| `enforce_max_favorites()` | trigger générique : 3 favoris actifs max (stratégies, lieux), verrou par utilisateur |

`updated_at` : trigger existant `set_updated_at()` réutilisé. Index : `user_id` sur chaque table
(RLS, lecture par utilisateur) ; aucun autre (faible volume).

**RPC** (`SECURITY INVOKER`, `authenticated`) :

| Fonction | Rôle |
| --- | --- |
| `add_user_substance(payload)` | slug du catalogue, précision « Autre », objectif, date ≤ aujourd'hui local ; 6 max ; doublon actif refusé (23505) |
| `set_primary_substance(id)` | échange atomique de la substance principale |
| `deactivate_user_substance(id)` | `is_active = false` ; refusé pour la principale et la dernière |
| `set_user_motivations(payload)` | remplacement atomique, au moins une, précision pour « other » |
| `set_primary_support_contact(id \| null)` | une personne principale au plus |

**Privilèges** : `select, insert, delete` + `update` limité aux colonnes modifiables (jamais
`user_id`, ni les références au catalogue). **RLS** : select / insert / update / delete de ses
propres lignes sur les 5 nouvelles tables (même modèle que les tables de l'onboarding).

### Vérifier le plan

```bash
npx supabase db query --linked -f supabase/tests/plan_rls.sql
```

Résultat attendu : `RLS_OK — plan : 22 vérifications réussies` (ajout / doublon / date future,
objectif et date sans toucher à l'historique, principale non désactivable, désactivation avec
historique intact et substance plus proposée, dernière substance, motivations ≥ 1, déclencheurs,
durées, 4e favori refusé (stratégies et lieux), personne principale unique, rappel / lettre uniques,
isolation A / B sur les 9 tables et par UUID deviné).

### Mode envie — migration `20260928090000_create_craving_mode.sql`

| Objet | Rôle |
| --- | --- |
| `craving_event_status` | `in_progress`, `completed`, `abandoned` (état technique) |
| `craving_strategies` | catalogue contrôlé (9 stratégies), lecture seule pour `authenticated` |
| `craving_events` | un moment d'envie : `local_date` (journée de début), `initial_craving_score` 0–10, `final_craving_score` 0–10, `trigger_unknown` (« Je ne sais pas »), `context_text` ≤ 2000, `outcome_text` ≤ 2000, `status`, `started_at`, `completed_at` |
| `craving_event_substances` | substances suivies concernées (PK moment + substance ; FK composite vers `user_substances (id, user_id)`) |
| `craving_event_emotions` | catalogue `emotions` (PK moment + émotion) |
| `craving_event_triggers` | catalogue `trigger_types` + `custom_label` pour « Autre » (PK moment + déclencheur) |
| `craving_interventions` | stratégie (catalogue XOR texte ≤ 500), `planned_duration_minutes` 1–120, `actual_duration_seconds`, `started_at`, `paused_at`, `paused_seconds`, `completed_at`, `helped_text` ≤ 2000 ; une par moment (index unique) |

Contraintes clés : `completed` ⇔ score final + `completed_at` ; fin ≥ début ; pas de pause après la
fin ; clés étrangères composites `(craving_event_id, user_id)` sur toutes les relations (impossible de
rattacher une ligne au moment d'un autre compte).

**Index** : `craving_events (user_id, started_at DESC)` — historique récent et moment en cours
(justifié : lecture la plus fréquente, triée par instant) ; index `user_id` sur les relations (RLS),
`user_substance_id`, `strategy_id`.

**RPC** (`SECURITY INVOKER`, `authenticated` seulement) :

| Fonction | Rôle |
| --- | --- |
| `start_craving_event(payload)` | crée le moment et ses relations en une transaction ; idempotente (id client) ; ferme d'abord les moments expirés |
| `start_craving_intervention(event_id, payload)` | stratégie + durée, démarre le minuteur ; idempotente |
| `update_craving_timer(event_id, action)` | `pause`, `resume`, `end` (durée réelle bornée à la durée prévue) |
| `complete_craving_event(event_id, payload)` | score final obligatoire, notes, termine l'intervention, `completed` |
| `dismiss_craving_event(event_id)` | « Ne pas continuer ce moment » → `abandoned` |
| `close_stale_craving_events()` | `in_progress` d'une journée passée → `abandoned` |
| `current_user_local_date()`, `lock_own_craving_event(id)` | aides internes |

**Privilèges** : `select, insert` + `update` limité à des colonnes précises (jamais `local_date`,
`started_at`, `user_id`) ; **aucune suppression** depuis l'application (la suppression de compte
passera par la cascade, Sprint 11).

**RLS** : `craving_strategies` — lecture des stratégies actives ; `craving_events` et
`craving_interventions` — select / insert / update de ses propres lignes ; relations — select /
insert de ses propres lignes (propriété du parent garantie par la clé composite).

### Vérifier le mode envie

```bash
npx supabase db query --linked -f supabase/tests/craving_rls.sql
```

Résultat attendu : `RLS_OK — craving : 24 vérifications réussies` (catalogue, bornes −1 / 11,
multi-substance, idempotence, deux moments le même jour, substance d'un autre compte, « Je ne sais
pas », stratégie personnelle, durée, minuteur pause / reprise, fin sans score refusée, journée non
modifiable, aucune suppression, mise de côté, expiration, isolation A / B par UUID deviné).

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
