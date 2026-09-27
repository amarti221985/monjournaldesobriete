import { statusOptions, type CheckinStatus } from "@/features/checkin/constants";
import { calculateFrequency, type FrequencyField } from "@/features/progress/analytics";
import { formatDecimal } from "@/features/progress/format";
import { calculateSobrietyMetrics } from "@/features/progress/metrics";
import type { ProgressLabels } from "@/features/progress/progress-insights";
import { average } from "@/features/progress/scores";
import type { ProgressCheckin } from "@/features/progress/types";
import { AI_LIMITS, truncateForAi, type AiPreferences } from "@/lib/ai/privacy";
import { formatLocalDate } from "@/lib/dates";

/*
 * Jeu de données d'un bilan hebdomadaire (ADR-083, ADR-085). Fonction PURE et testée :
 * - toutes les métriques sont calculées ici, par le code (le modèle ne calcule rien) ;
 * - seuls des libellés de catalogue, des dates et des nombres sont inclus par défaut ;
 * - les textes personnels ne sont ajoutés que pour les catégories autorisées, raccourcis ;
 * - jamais : identifiants, courriel, nom, contacts, lettre, lieux, rappel, raison, notes
 *   libres, précisions « Autre » saisies librement.
 */

export type WeeklyInsightSource = {
  range: { start: string; end: string };
  /** Check-ins TERMINÉS de la période (slugs + scores) */
  checkins: readonly ProgressCheckin[];
  labels: ProgressLabels;
  /** Textes de réflexion (jamais les notes libres) */
  reflections: readonly {
    date: string;
    status: CheckinStatus;
    victory: string | null;
    proudOf: string | null;
    lesson: string | null;
    tomorrowIntention: string | null;
  }[];
  consumptionTexts: readonly { date: string; context: string | null; reflection: string | null; nextTime: string | null }[];
  /** Moments d'envie TERMINÉS de la période */
  cravings: readonly {
    date: string;
    initial: number;
    final: number;
    /** Nom de la stratégie du catalogue, null pour une stratégie personnelle (texte libre exclu) */
    strategyName: string | null;
    context: string | null;
    helped: string | null;
    outcome: string | null;
  }[];
  /** Noms des accomplissements obtenus pendant la période */
  achievementsUnlocked: readonly string[];
};

export type WeeklyInsightDataset = ReturnType<typeof buildWeeklyInsightDataset>;

const round = (value: number | null) => (value === null ? null : Number(formatDecimal(value).replace(",", ".")));
const dayLabel = (date: string) => formatLocalDate(date, { weekday: "long", day: "numeric", month: "long" });

function frequencies(checkins: readonly ProgressCheckin[], field: FrequencyField, labels: Record<string, string>) {
  return calculateFrequency(checkins, field)
    .slice(0, AI_LIMITS.maxFrequencyItems)
    .map((item) => ({ name: labels[item.slug] ?? "Autre", days: item.days }));
}

export function buildWeeklyInsightDataset(source: WeeklyInsightSource, preferences: AiPreferences) {
  const metrics = calculateSobrietyMetrics(source.checkins);
  const cravings = source.cravings.slice(-AI_LIMITS.maxCravings);
  const strategyCounts = new Map<string, number>();
  for (const craving of cravings) {
    const name = craving.strategyName ?? "Stratégie personnelle";
    strategyCounts.set(name, (strategyCounts.get(name) ?? 0) + 1);
  }

  const dataset = {
    period: { start_date: source.range.start, end_date: source.range.end, days: AI_LIMITS.periodDays },
    summary: {
      tracked_days: metrics.trackedDays,
      sober_days: metrics.soberDays,
      sober_with_craving_days: metrics.challengingDays,
      consumption_days: metrics.consumedDays,
      average_mood: round(average(source.checkins.map((item) => item.mood))),
      average_energy: round(average(source.checkins.map((item) => item.energy))),
      average_stress: round(average(source.checkins.map((item) => item.stress))),
      average_craving: round(average(source.checkins.map((item) => item.craving))),
    },
    days: [...source.checkins]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((item) => ({
        day: dayLabel(item.date),
        status: statusOptions[item.status].label,
        mood: item.mood,
        stress: item.stress,
        craving: item.craving,
      })),
    frequent_emotions: frequencies(source.checkins, "emotions", source.labels.emotions),
    frequent_triggers: frequencies(source.checkins, "triggers", source.labels.triggers),
    frequent_achievements: frequencies(source.checkins, "achievements", source.labels.achievements),
    craving_interventions: {
      completed: cravings.length,
      average_initial: round(average(cravings.map((item) => item.initial))),
      average_final: round(average(cravings.map((item) => item.final))),
      decreased: cravings.filter((item) => item.final < item.initial).length,
      unchanged: cravings.filter((item) => item.final === item.initial).length,
      increased: cravings.filter((item) => item.final > item.initial).length,
    },
    strategies_used: [...strategyCounts.entries()].map(([name, times]) => ({ name, times })),
    achievements_unlocked: source.achievementsUnlocked.slice(0, 10),
    ...(preferences.includeReflections
      ? {
          reflections: [...source.reflections]
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(-AI_LIMITS.maxReflections)
            .map((item) => ({
              day: dayLabel(item.date),
              status: statusOptions[item.status].label,
              victory: truncateForAi(item.victory),
              proud_of: truncateForAi(item.proudOf),
              lesson: truncateForAi(item.lesson),
              tomorrow_intention: truncateForAi(item.tomorrowIntention),
            }))
            .filter((item) => item.victory || item.proud_of || item.lesson || item.tomorrow_intention),
        }
      : {}),
    ...(preferences.includeConsumptionContext
      ? {
          consumption_context: source.consumptionTexts
            .map((item) => ({
              day: dayLabel(item.date),
              context: truncateForAi(item.context),
              reflection: truncateForAi(item.reflection),
              next_time: truncateForAi(item.nextTime),
            }))
            .filter((item) => item.context || item.reflection || item.next_time),
        }
      : {}),
    ...(preferences.includeCravingContext
      ? {
          craving_context: cravings
            .map((item) => ({
              day: dayLabel(item.date),
              context: truncateForAi(item.context),
              helped: truncateForAi(item.helped),
              note: truncateForAi(item.outcome),
            }))
            .filter((item) => item.context || item.helped || item.note),
        }
      : {}),
  };
  return dataset;
}

/** Clés de justification réellement présentes dans un jeu de données (ancrage des observations). */
export function availableEvidenceKeys(dataset: WeeklyInsightDataset): Set<string> {
  const keys = new Set<string>([
    "tracked_days",
    "sober_days",
    "sober_with_craving_days",
    "consumption_days",
    "average_mood",
    "average_energy",
    "average_stress",
    "average_craving",
    "craving_interventions",
  ]);
  if (dataset.frequent_emotions.length) keys.add("frequent_emotions");
  if (dataset.frequent_triggers.length) keys.add("frequent_triggers");
  if (dataset.frequent_achievements.length) keys.add("frequent_achievements");
  if (dataset.strategies_used.length) keys.add("strategies_used");
  if (dataset.achievements_unlocked.length) keys.add("achievements_unlocked");
  if ("reflections" in dataset && dataset.reflections?.length) keys.add("reflections");
  if ("consumption_context" in dataset && dataset.consumption_context?.length) keys.add("consumption_context");
  if ("craving_context" in dataset && dataset.craving_context?.length) keys.add("craving_context");
  return keys;
}
