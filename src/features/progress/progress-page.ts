import {
  calculateAchievementAssociations,
  calculateAchievementFrequency,
  calculateConsumptionSummary,
  calculateEmotionFrequency,
  calculateScoreTrends,
  calculateStatusDistribution,
  calculateStressCravingAssociation,
  calculateTriggerConsumptionShare,
  calculateTriggerFrequency,
  calculateWeekdayCraving,
  comparePeriods,
  type AchievementAssociation,
  type AchievementFrequency,
  type ConsumptionSummary,
  type CravingAssociation,
  type EmotionFrequency,
  type PeriodComparison,
  type ScoreTrend,
  type StatusDistribution,
  type TriggerConsumptionShare,
  type TriggerFrequency,
  type WeekdayCravingSummary,
} from "@/features/progress/analytics";
import { calculateSobrietyMetrics, calculateStreaks, type SobrietyMetrics, type StreakMetrics } from "@/features/progress/metrics";
import {
  countRangeDays,
  filterCheckinsInRange,
  getPeriodRange,
  getPreviousPeriodRange,
  type DateRange,
  type ProgressPeriod,
} from "@/features/progress/periods";
import {
  generateProgressInsights,
  PROGRESS_INSIGHT_RULES,
  type DescriptiveInsight,
  type ProgressLabels,
} from "@/features/progress/progress-insights";
import { buildScoreSeries, type ScorePoint } from "@/features/progress/scores";
import { sortByDate, type ProgressCheckin } from "@/features/progress/types";

/** Métriques de la période : exactement celles du tableau de bord (ADR-041). */
export type ProgressMetrics = SobrietyMetrics;

export type InsightsState =
  /** Au moins une observation */
  | "ready"
  /** Assez de check-ins, mais aucune règle n'a atteint son seuil */
  | "none"
  /** Moins de 10 check-ins au total */
  | "collecting"
  /** 10 check-ins ou plus au total, mais pas dans cette période */
  | "longer_period";

export type ProgressPageData = {
  period: ProgressPeriod;
  range: DateRange;
  /** Période précédente équivalente (7, 30 et 90 jours seulement) */
  previousRange: DateRange | null;
  /** Journées calendaires couvertes par la période */
  calendarDays: number;
  /** Métriques de la période sélectionnée */
  metrics: ProgressMetrics;
  /** Depuis le début du parcours (tous les check-ins terminés) */
  allTime: { metrics: ProgressMetrics; streaks: StreakMetrics };
  scorePoints: ScorePoint[];
  /** Moyennes de la période, avec la comparaison si elle est fiable */
  scoreTrends: ScoreTrend[];
  comparison: PeriodComparison | null;
  distribution: StatusDistribution;
  triggers: TriggerFrequency[];
  emotions: EmotionFrequency[];
  achievements: AchievementFrequency[];
  achievementAssociations: AchievementAssociation[];
  stressAssociation: CravingAssociation | null;
  weekday: WeekdayCravingSummary;
  consumption: ConsumptionSummary;
  triggerConsumptionShare: TriggerConsumptionShare | null;
  insights: DescriptiveInsight[];
  insightsState: InsightsState;
};

const PERIOD_SENTENCE_LABELS: Record<ProgressPeriod, string> = {
  "7d": "7 derniers jours",
  "30d": "30 derniers jours",
  "90d": "90 derniers jours",
  year: "journées de cette année",
  all: "journées de ton parcours",
};

/**
 * Prépare toutes les données de la page Progression à partir des check-ins TERMINÉS.
 * Fonction pure : la page et les composants n'effectuent aucun calcul.
 */
export function buildProgressPage(
  today: string,
  allCheckins: readonly ProgressCheckin[],
  period: ProgressPeriod,
  labels: ProgressLabels,
): ProgressPageData {
  // Garde-fou : jamais de journée future dans les calculs.
  const past = sortByDate(allCheckins.filter((checkin) => checkin.date <= today));
  const range = getPeriodRange(period, today, past[0]?.date ?? null);
  const previousRange = getPreviousPeriodRange(period, today);
  const current = filterCheckinsInRange(past, range);
  const previous = previousRange ? filterCheckinsInRange(past, previousRange) : null;
  const calendarDays = countRangeDays(range);

  const comparison = previous ? comparePeriods(current, previous) : null;
  const consumption = calculateConsumptionSummary(current);
  const insights = generateProgressInsights({ current, previous, periodLabel: PERIOD_SENTENCE_LABELS[period], labels });

  let insightsState: InsightsState;
  if (insights.length > 0) insightsState = "ready";
  else if (current.length >= PROGRESS_INSIGHT_RULES.minCheckins) insightsState = "none";
  else if (past.length >= PROGRESS_INSIGHT_RULES.minCheckins) insightsState = "longer_period";
  else insightsState = "collecting";

  return {
    period,
    range,
    previousRange,
    calendarDays,
    metrics: calculateSobrietyMetrics(current),
    allTime: { metrics: calculateSobrietyMetrics(past), streaks: calculateStreaks(past) },
    scorePoints: buildScoreSeries(today, current, calendarDays),
    scoreTrends: comparison?.sufficient ? comparison.scores : calculateScoreTrends(current),
    comparison,
    distribution: calculateStatusDistribution(current),
    triggers: calculateTriggerFrequency(current),
    emotions: calculateEmotionFrequency(current),
    achievements: calculateAchievementFrequency(current),
    achievementAssociations: calculateAchievementAssociations(current),
    stressAssociation: calculateStressCravingAssociation(current),
    weekday: calculateWeekdayCraving(current),
    consumption,
    triggerConsumptionShare: calculateTriggerConsumptionShare(consumption),
    insights,
    insightsState,
  };
}
