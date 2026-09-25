import type { TrendDirection } from "@/features/progress/analytics";
import type { ScoreSeriesKey } from "@/features/progress/scores";

/**
 * Présentation des quatre scores. Couleurs : tokens --series-* validés (contraste +
 * daltonisme, ADR-043) ; le libellé est toujours affiché, la couleur n'est jamais seule.
 */
export const scoreMeta: Record<ScoreSeriesKey, { label: string; averageLabel: string; color: string; min: number }> = {
  mood: { label: "Humeur", averageLabel: "Humeur moyenne", color: "var(--series-mood)", min: 1 },
  energy: { label: "Énergie", averageLabel: "Énergie moyenne", color: "var(--series-energy)", min: 1 },
  stress: { label: "Stress", averageLabel: "Stress moyen", color: "var(--series-stress)", min: 1 },
  craving: { label: "Envie", averageLabel: "Envie moyenne", color: "var(--series-craving)", min: 0 },
};

/** Mots neutres : on décrit le sens de la variation, jamais sa valeur (« bon », « mauvais »). */
export const trendLabels: Record<TrendDirection, string> = {
  up: "en hausse",
  down: "en baisse",
  stable: "relativement stable",
};
