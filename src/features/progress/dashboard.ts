import { generateDescriptiveInsights, INSIGHT_RULES, type Insight } from "@/features/progress/insights";
import { calculateSobrietyMetrics, calculateStreaks, type SobrietyMetrics, type StreakMetrics } from "@/features/progress/metrics";
import { buildScoreSeries, calculateScoreAverages, type ScoreAverages, type ScorePoint } from "@/features/progress/scores";
import type { ProgressCheckin } from "@/features/progress/types";
import { buildCurrentWeek, calculateRecentDaysSummary, type RecentDaysSummary, type WeekDay } from "@/features/progress/week";

export const SCORE_PERIODS = [7, 30] as const;
export type ScorePeriod = (typeof SCORE_PERIODS)[number];

export type ScorePeriodData = {
  days: ScorePeriod;
  points: ScorePoint[];
  averages: ScoreAverages;
};

export type DashboardData = {
  metrics: SobrietyMetrics;
  streaks: StreakMetrics;
  week: WeekDay[];
  recentDays: RecentDaysSummary;
  scores: ScorePeriodData[];
  insights: Insight[];
  /** Check-ins terminés restant avant les premières tendances (0 si atteint). */
  checkinsBeforeInsights: number;
};

/**
 * Prépare toutes les données du tableau de bord à partir des check-ins TERMINÉS.
 * Fonction pure : aucun calcul n'est fait dans les composants.
 */
export function buildDashboard(today: string, checkins: readonly ProgressCheckin[]): DashboardData {
  // Garde-fou : jamais de journée future dans les calculs.
  const past = checkins.filter((checkin) => checkin.date <= today);

  return {
    metrics: calculateSobrietyMetrics(past),
    streaks: calculateStreaks(past),
    week: buildCurrentWeek(today, past),
    recentDays: calculateRecentDaysSummary(today, past),
    scores: SCORE_PERIODS.map((days) => {
      const points = buildScoreSeries(today, past, days);
      return { days, points, averages: calculateScoreAverages(points) };
    }),
    insights: generateDescriptiveInsights(past),
    checkinsBeforeInsights: Math.max(0, INSIGHT_RULES.minCheckins - past.length),
  };
}
