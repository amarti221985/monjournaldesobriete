# Bilans intelligents (IA) — Sprint 12

Fonction **facultative, désactivée par défaut**, qui aide l'utilisateur à prendre du recul sur sa
semaine à partir de ses propres données. Ce n'est ni un chatbot, ni un outil médical, ni un
système de prédiction. Décisions : ADR-082 à ADR-087 (`docs/DECISIONS.md`).

## Ce que fait la fonction

- Page `/insights` (« Mes bilans ») : bilan des **7 derniers jours calendaires** (aujourd'hui
  inclus, fuseau du profil), généré seulement quand l'utilisateur clique sur « Générer mon bilan ».
- Sections : « Ta semaine en quelques mots », « Ce qui ressort », « Ce que tu as continué à
  construire », « Tes points d'appui », « Moments plus difficiles », « Questions pour toi ».
- Chaque bilan porte l'étiquette « Généré avec l'aide de l'IA à partir de tes données
  enregistrées. » et l'avertissement « outil de réflexion, peut contenir des erreurs, ne remplace
  pas un professionnel de la santé ».
- Historique (« Bilans précédents »), suppression d'un bilan, suppression de tous les bilans,
  désactivation (les bilans existants sont conservés).
- Paramètres : section « Intelligence et confidentialité » (état, catégories, désactiver,
  supprimer mes bilans IA).

## Consentement (ADR-082)

- `ai_preferences.ai_enabled = false` par défaut ; aucune ligne = désactivé.
- L'activation passe par l'écran de consentement : données utilisées, données **jamais envoyées**,
  fournisseur, limites de l'IA, possibilité de désactiver et de supprimer. La Server Action exige
  `consentAcknowledged: true` ; la base exige `consented_at` + `consent_version`
  (`ai_preferences_enabled_requires_consent`).
- `AI_CONSENT_VERSION` (`src/lib/ai/privacy.ts`) : si le texte du consentement change, la version
  change et un consentement antérieur n'est plus valable (`getAiPreferences`).
- La désactivation horodate `revoked_at`. `reserve_ai_generation()` et `save_ai_reflection()`
  refusent toute génération sans consentement actif (`ai_consent_required`).

## Données envoyées (ADR-083, ADR-085)

Pipeline (`src/features/insights/actions.ts`) : session → préférences → fournisseur configuré →
période → lecture des seules données autorisées (`collectWeeklyInsightSource`) → contrôles
préalables (sans consommer de génération) → réservation (3 / jour) → **minimisation**
(`buildWeeklyInsightDataset`, fonction pure testée) → appel → validation → persistance.

Toujours inclus (catalogues, dates, nombres calculés **par le code**) :

- période ; journées suivies, sobres, sobres avec envie, avec consommation ; moyennes humeur /
  énergie / stress / envie (`calculateSobrietyMetrics`, `average`) ;
- par journée : jour de la semaine, état, humeur, stress, envie ;
- émotions, déclencheurs et accomplissements du jour les plus fréquents (libellés du catalogue) ;
- interventions terminées (moyennes avant / après, baisse / stable / hausse) et stratégies du
  catalogue utilisées (une stratégie personnelle devient « Stratégie personnelle ») ;
- noms des accomplissements obtenus pendant la période.

Selon les catégories cochées (raccourcis à 280 caractères, 7 réflexions au plus) :

- **Mes réflexions** (cochée par défaut dans l'écran de consentement) : victoire, fierté, leçon,
  intention ;
- **Contexte de mes consommations** (non cochée) : contexte, réflexion, stratégie pour la prochaine fois ;
- **Contexte de mes moments d'envie** (non cochée) : contexte, « ce qui m'a aidé », note.

**Jamais envoyés** : courriel, nom affiché, identifiants (UUID), personnes de soutien, lettre à
soi-même, lieux sûrs, rappel personnel, raison personnelle, notes libres des check-ins, précisions
« Autre » saisies librement, textes des stratégies personnelles, quantités. Vérifié par des tests
unitaires (marqueurs fictifs) et par un test d'intégration qui capture la requête réellement émise
(faux fournisseur local, comptes fictifs).

## Fournisseur (ADR-084)

- Interface `AiProvider` (`src/lib/ai/provider.ts`) ; implémentation `AnthropicProvider`
  (`src/lib/ai/anthropic-provider.ts`, `server-only`) avec le SDK officiel `@anthropic-ai/sdk`.
- Variables d'environnement **serveur** : `ANTHROPIC_API_KEY` (obligatoire pour activer la
  fonction) et `AI_MODEL` (facultatif, défaut `claude-opus-5`). Sans clé, `/insights` indique que
  la fonction n'est pas disponible et **rien n'est envoyé**. Aucune variable `NEXT_PUBLIC_*`.
- Appel : `messages.parse` + sortie structurée (`zodOutputFormat`), prompt système mis en cache
  (`cache_control`), `max_tokens` 4000, délai 60 s, 1 nouvelle tentative réseau.
- Refus, dépassement de délai, indisponibilité → message générique « Impossible de générer ton
  bilan pour le moment. Tes données n'ont pas été modifiées. ». Les solutions de repli côté
  serveur en cas de refus du modèle ne sont **pas** activées : un refus est traité comme une erreur.
- Journaux : seulement `request_id`, modèle, `stop_reason`, latence, nombre de jetons. Jamais le
  prompt, le jeu de données, la réponse ni le journal.
- Aucune donnée réelle n'a été utilisée pour tester le fournisseur (tests : fournisseur simulé).

## Garde-fous (ADR-086, ADR-087)

- Prompt versionné (`PROMPT_VERSION = "weekly-reflection-v1"`, `src/lib/ai/prompts.ts`) : ancrage
  dans les données fournies, aucun recalcul, aucun diagnostic, aucune prédiction, association ≠
  cause, progression plutôt que perfection, aucun jugement ni injonction, comportements observables.
- Sortie validée par un schéma Zod strict (`weeklyReflectionSchema`) : tailles, 0 à 3 observations
  par section, 2 ou 3 questions, `evidence_keys` d'une liste fermée.
- `validateWeeklyReflection` refuse une observation appuyée sur une donnée absente du jeu envoyé
  et tout vocabulaire interdit (diagnostic, prédiction, causalité, jugement, injonction). Une
  sortie refusée n'est jamais enregistrée ; une seule nouvelle génération est tentée.
- Le texte est rendu par React (échappé), jamais comme HTML.

## Limites et coûts

- 3 générations par jour et par utilisateur (journée UTC), appliquées par la base
  (`reserve_ai_generation`, compteur non modifiable par le client). La réservation a lieu **avant**
  l'appel ; une génération échouée est comptée.
- Au moins 3 check-ins terminés sur la période, sinon « Il n'y a pas encore assez de journées
  enregistrées pour créer un bilan utile. ».

## Stockage (ADR-087)

`ai_reflections` conserve uniquement le résultat validé (`summary`, `content`), la période, le
fournisseur, le modèle, la version du prompt et la date. Jamais le prompt complet, le jeu de
données, les textes envoyés ni la réponse brute. Régénérer la même période remplace le bilan.
Les bilans figurent dans l'export JSON (`ai`) et, sur option, dans le rapport PDF ; ils sont
supprimés avec le compte.

## Configuration en production (Hostinger)

1. Créer une clé chez Anthropic (compte du propriétaire du service).
2. Ajouter `ANTHROPIC_API_KEY` (et éventuellement `AI_MODEL`) aux variables d'environnement de
   l'application ; redémarrer. Ne jamais la committer ni la préfixer `NEXT_PUBLIC_`.
3. Vérifier `/insights` : l'écran d'activation apparaît (sinon, la clé n'est pas lue).
