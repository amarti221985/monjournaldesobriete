import type { CheckinStatus } from "@/features/checkin/constants";

/**
 * Check-in TERMINÉ, réduit aux données nécessaires aux statistiques (ADR-039).
 * Les brouillons ne sont jamais transmis aux calculs.
 */
export type ProgressCheckin = {
  /** Journée locale YYYY-MM-DD */
  date: string;
  status: CheckinStatus;
  mood: number | null;
  energy: number | null;
  stress: number | null;
  craving: number | null;
  /** Slugs des déclencheurs (trigger_types) */
  triggers: string[];
  /** Slugs des accomplissements (achievement_types) */
  achievements: string[];
  /** Slugs des émotions (emotions) */
  emotions: string[];
  /**
   * Événements de consommation : seulement la substance suivie concernée (id de
   * user_substances). Aucune quantité ni texte : les quantités ne sont jamais additionnées.
   */
  consumptionEvents: { substanceId: string }[];
};

/** Une journée sobre enregistrée : « sober » ou « sober_with_craving » (ADR-041). */
export function isSoberStatus(status: CheckinStatus): boolean {
  return status === "sober" || status === "sober_with_craving";
}

/** Tri chronologique par journée locale (sans muter l'entrée). */
export function sortByDate<T extends { date: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.date.localeCompare(b.date));
}
