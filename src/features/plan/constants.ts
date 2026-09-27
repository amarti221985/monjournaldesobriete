/*
 * Mon plan (Sprint 8). Mêmes bornes que la migration 20260929090000_create_personal_plan.sql
 * (la base revalide tout, y compris la limite de favoris).
 */

export const PLAN_TEXT_LIMITS = {
  reason: 2000,
  triggerLabel: 80,
  triggerNotes: 1000,
  strategyName: 120,
  strategyNotes: 1000,
  placeName: 80,
  placeDescription: 300,
  reminder: 1000,
  letterTitle: 120,
  letter: 5000,
} as const;

/** Durées par défaut d'une stratégie du plan ; null = aucune. */
export const PLAN_STRATEGY_DURATIONS = [null, 5, 10, 15, 20] as const;
export type PlanStrategyDuration = (typeof PLAN_STRATEGY_DURATIONS)[number];

/** Favoris maximum (stratégies, lieux) — appliqué aussi par un trigger en base. */
export const MAX_PLAN_FAVORITES = 3;

export const MAX_SUPPORT_CONTACTS = 10;

export const DEFAULT_LETTER_TITLE = "À relire quand c'est difficile";

export const PLAN_SAVE_ERROR =
  "Nous n'avons pas pu enregistrer cette modification. Tes informations sont toujours affichées.";

export const PLAN_SAVED = "Modifications enregistrées";

/** Exemples affichés dans l'interface seulement (jamais enregistrés). */
export const SAFE_PLACE_EXAMPLES = [
  "Chez un proche",
  "Un café",
  "Un parc",
  "La bibliothèque",
  "Le gym",
  "Un endroit public calme",
] as const;

export const REMINDER_PLACEHOLDER =
  "Cette envie va passer. Je n'ai pas besoin de prendre une décision pour toute ma vie aujourd'hui. Je veux seulement traverser ce moment.";
