/*
 * Mode « J'ai envie de consommer » (Sprint 7). Mêmes bornes que la migration
 * 20260928090000_create_craving_mode.sql (la base revalide tout).
 */

export const CRAVING_TEXT_LIMITS = {
  contextText: 2000,
  customStrategyText: 500,
  helpedText: 2000,
  outcomeText: 2000,
  customLabel: 80,
} as const;

export const MAX_CRAVING_SELECTIONS = 20;
export const MAX_CRAVING_SUBSTANCES = 10;

/** Durées proposées (20 : durée possible d'une stratégie du plan) ; null = « Sans minuteur ». 10 minutes par défaut. */
export const CRAVING_DURATION_OPTIONS = [5, 10, 15, 20, null] as const;
export type CravingDurationOption = (typeof CRAVING_DURATION_OPTIONS)[number];
export const DEFAULT_CRAVING_DURATION: CravingDurationOption = 10;
export const MAX_PLANNED_DURATION_MINUTES = 120;

/** « Ma propre stratégie » : pas une ligne du catalogue (strategy_id NULL + texte). */
export const CUSTOM_STRATEGY = "custom" as const;

/** Analyse des stratégies : utilisations complétées minimales par stratégie (ADR-061). */
export const STRATEGY_MIN_COMPLETED = 3;

export const RECENT_CRAVING_LIMIT = 5;
export const CRAVING_HISTORY_LIMIT = 100;

export const CRAVING_SAVE_ERROR =
  "Nous n'avons pas pu enregistrer cette étape. Tes réponses sont toujours affichées.";

export const CRAVING_SAFETY_NOTE =
  "Si tu te sens en danger, si tu risques une intoxication ou un sevrage grave, ou si tu as besoin d'une aide immédiate, contacte les services d'urgence ou un professionnel de la santé.";
