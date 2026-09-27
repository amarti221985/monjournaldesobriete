# Confidentialité — documentation technique interne

> Document technique, pas une politique de confidentialité juridique. La conformité à une loi
> (Loi 25 au Québec, LPRPDE / PIPEDA, RGPD, HIPAA…) exige une analyse distincte ; aucune n'est
> revendiquée ici.

## Principe

**Les données appartiennent à l'utilisateur** (ADR-075) : il peut les consulter, les exporter et
supprimer définitivement son compte. Les données sont privées, jamais publiques, jamais partagées
automatiquement, jamais utilisées pour de la publicité.

## Catégories et finalités

| Catégorie | Données | Finalité |
| --- | --- | --- |
| Compte | courriel (Supabase Auth), nom affiché, fuseau horaire | connexion, personnalisation, journées locales |
| Parcours | substances suivies, objectifs, dates de départ, raison, motivations | contexte du parcours |
| Journal | check-ins, scores, réflexions, émotions, déclencheurs, accomplissements du jour, consommations | journal personnel, statistiques |
| Interventions | moments d'envie, scores avant / après, contexte, stratégie, notes | outil « J'ai envie de consommer » |
| Plan personnel | déclencheurs, stratégies, personnes de soutien (données de tiers), lieux sûrs (texte), rappel, lettre | préparation personnelle |
| Progression | accomplissements obtenus | reconnaissance des jalons |
| Catalogue système | substances, émotions, déclencheurs, stratégies, jalons | libellés communs (non personnels) |

Minimisation : aucune géolocalisation ; les contacts de soutien se limitent à nom, relation,
téléphone, courriel ; le courriel n'est pas dupliqué dans `profiles` (Supabase Auth est la source).
Aucune donnée stockée sans usage identifiée.

## Carte des données (schéma réel)

| Data | Table | Owner | Sensitive | Exported | Deleted with account |
| --- | --- | --- | --- | --- | --- |
| Courriel, mot de passe (haché) | `auth.users` (Supabase Auth) | l'utilisateur | oui | courriel seulement | oui |
| Nom affiché, fuseau, onboarding | `profiles` | `id` | moyen | oui | oui (cascade) |
| Substances suivies, objectifs, dates | `user_substances` | `user_id` | oui | oui | oui (cascade) |
| Raison | `personal_reasons` | `user_id` | oui | oui | oui (cascade) |
| Motivations | `user_motivations` | `user_id` | moyen | oui | oui (cascade) |
| Personnes de soutien | `support_contacts` | `user_id` | oui (tiers) | oui | oui (cascade) |
| Brouillon d'onboarding | `onboarding_drafts` | `user_id` | oui | non (temporaire, supprimé à la fin de l'onboarding) | oui (cascade) |
| Check-ins, scores, réflexions | `daily_checkins` | `user_id` | oui | oui | oui (cascade) |
| Émotions du jour | `checkin_emotions` | `user_id` (parent composite) | oui | oui (libellés) | oui (via check-in) |
| Déclencheurs du jour | `checkin_triggers` | `user_id` (parent composite) | oui | oui | oui (via check-in) |
| Accomplissements du jour | `checkin_achievements` | `user_id` (parent composite) | moyen | oui | oui (via check-in) |
| Consommations | `consumption_events` | `user_id` (parents composites) | oui | oui | oui (via check-in) |
| Moments d'envie | `craving_events` | `user_id` | oui | oui | oui (cascade) |
| Substances d'un moment | `craving_event_substances` | `user_id` (parents composites) | oui | oui | oui (via moment) |
| Émotions d'un moment | `craving_event_emotions` | `user_id` (parent composite) | oui | oui | oui (via moment) |
| Déclencheurs d'un moment | `craving_event_triggers` | `user_id` (parent composite) | oui | oui | oui (via moment) |
| Interventions | `craving_interventions` | `user_id` (parent composite) | oui | oui | oui (via moment) |
| Déclencheurs personnels | `user_personal_triggers` | `user_id` | oui | oui | oui (cascade) |
| Stratégies personnelles | `user_personal_strategies` | `user_id` | moyen | oui | oui (cascade) |
| Lieux sûrs (texte) | `safe_places` | `user_id` | oui | oui | oui (cascade) |
| Rappel personnel | `personal_reminders` | `user_id` | oui | oui | oui (cascade) |
| Lettre à soi-même | `self_letters` | `user_id` | très | oui | oui (cascade) |
| Accomplissements obtenus | `user_achievements` | `user_id` | faible | oui | oui (cascade) |
| Catalogues | `substances`, `emotions`, `trigger_types`, `achievement_types`, `craving_strategies`, `achievement_definitions` | système | non | libellés utilisés seulement | non (communs) |

## Stockage et tiers techniques

- **Supabase** : base PostgreSQL et authentification (projet `nnzdossiysgkdcsdutko`).
- **Hostinger** : hébergement de l'application Node.js (Next.js).
- Aucun autre service : pas d'analytique, de relecture de session, de publicité, de CDN tiers pour
  les données, ni d'IA. Polices servies par l'application.

## Accès, export, suppression

- **Export** : `/settings` → « Exporter mes données » : fichier JSON versionné
  (`mes-donnees-AAAA-MM-JJ.json`), généré pour l'utilisateur connecté uniquement, jamais mis en
  cache (ADR-076, ADR-078).
- **Suppression** : `/settings` → « Supprimer mon compte » : export proposé, saisie de
  « SUPPRIMER » et du mot de passe, suppression définitive du compte et de toutes les données
  personnelles (ADR-077). Aucune période de restauration.
- **Conservation** : les données sont conservées tant que l'utilisateur ne les supprime pas ou ne
  supprime pas son compte ; aucune suppression automatique. Les sauvegardes du fournisseur suivent
  sa propre politique.

## Intelligence artificielle

**Aucune donnée personnelle n'est actuellement envoyée à un fournisseur d'IA** et aucune fonction
IA n'est active (affiché dans les paramètres). Avant toute fonction IA (Sprint 12), il faudra
définir : les données sélectionnées (minimales), un consentement explicite et révocable, le
fournisseur et sa localisation, la rétention côté fournisseur, un opt-out, et l'exclusion par
défaut des données les plus sensibles (lettre, contacts).

## Hors périmètre actuel

Le Sprint 10 (PWA, notifications, service worker, hors ligne) est **reporté** : aucune donnée
n'est mise en cache sur l'appareil par l'application.
