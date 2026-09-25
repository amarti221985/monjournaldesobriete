import {
  ANALYTICS_THRESHOLDS,
  calculateAchievementAssociations,
  calculateAchievementFrequency,
  calculateConsumptionSummary,
  calculateStressCravingAssociation,
  calculateTriggerConsumptionShare,
  calculateTriggerFrequency,
  calculateWeekdayCraving,
  comparePeriods,
  type CravingAssociation,
} from "@/features/progress/analytics";
import { formatDecimal, formatScore, pluralize } from "@/features/progress/format";
import type { ScoreSeriesKey } from "@/features/progress/scores";
import type { ProgressCheckin } from "@/features/progress/types";

/*
 * Observations de la page Progression (ADR-055) — PAS d'IA : règles déterministes,
 * seuils documentés, données de l'utilisateur uniquement. Chaque observation décrit
 * une fréquence ou une association dans SES données et donne sa base de calcul ;
 * aucune n'affirme de cause, de diagnostic ni de prédiction (vérifié par les tests).
 */

export const PROGRESS_INSIGHT_RULES = {
  /** En dessous, dans la période : aucune observation avancée. */
  minCheckins: 10,
  maxInsights: 5,
  /** Évolution : check-ins minimaux dans CHAQUE période (plus strict que la comparaison affichée). */
  evolutionMinCheckinsPerPeriod: 5,
  /** Évolution : écart minimal en points sur 10. */
  evolutionMinDifference: 1,
  /** Déclencheur ou accomplissement le plus fréquent : journées minimales. */
  frequencyMinDays: 3,
} as const;

export type DescriptiveInsight = {
  id: "evolution" | "trigger" | "association" | "weekday" | "achievement";
  text: string;
  /** Base du calcul, pour la transparence (« Basé sur 12 journées… ») */
  basis: string;
};

/** Libellés des catalogues (slug → nom affiché). */
export type ProgressLabels = {
  triggers: Record<string, string>;
  emotions: Record<string, string>;
  achievements: Record<string, string>;
};

export type InsightContext = {
  /** Check-ins terminés de la période sélectionnée */
  current: readonly ProgressCheckin[];
  /** Check-ins de la période précédente (null si la période n'est pas comparable) */
  previous: readonly ProgressCheckin[] | null;
  /** « 30 derniers jours » */
  periodLabel: string;
  labels: ProgressLabels;
};

const SCORE_SUBJECT: Record<ScoreSeriesKey, string> = {
  mood: "ton humeur moyenne",
  energy: "ton énergie moyenne",
  stress: "ton stress moyen",
  craving: "ton envie moyenne",
};

function days(count: number): string {
  return `${count} ${pluralize(count, "journée", "journées")}`;
}

function label(labels: Record<string, string>, slug: string): string {
  return labels[slug] ?? "Autre";
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Modèles de phrases : seul endroit où le texte des observations est construit. */
export const progressInsightTemplates = {
  evolution: (key: ScoreSeriesKey, current: number, previous: number, periodLabel: string) =>
    `Sur les ${periodLabel}, ${SCORE_SUBJECT[key]} est de ${formatScore(current)}, contre ${formatScore(previous)} sur la période précédente.`,
  triggerConsumption: (name: string, count: number, consumedDays: number) =>
    `« ${name} » apparaît dans ${count} de tes ${consumedDays} journées avec consommation enregistrées.`,
  topTrigger: (name: string, count: number) =>
    `« ${name} » est le déclencheur que tu as le plus souvent enregistré sur cette période (${days(count)}).`,
  achievementAssociation: (name: string, association: CravingAssociation) =>
    `Dans tes données, les journées où tu as enregistré « ${name} » sont associées à une envie moyenne de ${formatScore(association.withAverage)}, comparativement à ${formatScore(association.withoutAverage)} les autres journées.`,
  stressAssociation: (association: CravingAssociation) =>
    `Sur tes journées où le stress était de ${ANALYTICS_THRESHOLDS.highStressMin}/10 ou plus, ton envie moyenne était de ${formatScore(association.withAverage)} ; sur les autres journées enregistrées, elle était de ${formatScore(association.withoutAverage)}.`,
  weekday: (name: string, value: number, count: number) =>
    `Parmi les jours suffisamment documentés, ton envie moyenne a été la plus élevée le ${name} : ${formatScore(value)} sur ${count} ${name}s enregistrés.`,
  topAchievement: (name: string, count: number) =>
    `« ${name} » est l'accomplissement que tu as le plus souvent enregistré sur cette période (${days(count)}).`,
};

function evolutionInsight(context: InsightContext): DescriptiveInsight | null {
  if (!context.previous) return null;
  const { evolutionMinCheckinsPerPeriod, evolutionMinDifference } = PROGRESS_INSIGHT_RULES;
  if (context.current.length < evolutionMinCheckinsPerPeriod || context.previous.length < evolutionMinCheckinsPerPeriod) {
    return null;
  }
  const comparison = comparePeriods(context.current, context.previous);
  const largest = comparison.scores
    .filter((score) => score.difference !== null && Math.abs(score.difference) >= evolutionMinDifference)
    .sort((a, b) => Math.abs(b.difference ?? 0) - Math.abs(a.difference ?? 0))[0];
  if (!largest || largest.current === null || largest.previous === null) return null;

  return {
    id: "evolution",
    text: progressInsightTemplates.evolution(largest.key, largest.current, largest.previous, context.periodLabel),
    basis: `Basé sur ${days(comparison.currentCount)} enregistrées sur cette période et ${comparison.previousCount} sur la précédente.`,
  };
}

function triggerInsight(context: InsightContext): DescriptiveInsight | null {
  const share = calculateTriggerConsumptionShare(calculateConsumptionSummary(context.current));
  if (share) {
    return {
      id: "trigger",
      text: progressInsightTemplates.triggerConsumption(label(context.labels.triggers, share.slug), share.days, share.consumedDays),
      basis: `Basé sur tes ${share.consumedDays} journées avec consommation de la période. Une fréquence n'indique pas une cause.`,
    };
  }
  const top = calculateTriggerFrequency(context.current)[0];
  if (!top || top.days < PROGRESS_INSIGHT_RULES.frequencyMinDays) return null;
  return {
    id: "trigger",
    text: progressInsightTemplates.topTrigger(label(context.labels.triggers, top.slug), top.days),
    basis: `Basé sur ${days(context.current.length)} enregistrées. Une fréquence n'indique pas une cause.`,
  };
}

function associationInsight(context: InsightContext): DescriptiveInsight | null {
  const stress = calculateStressCravingAssociation(context.current);
  const achievement = calculateAchievementAssociations(context.current)[0] ?? null;
  // L'écart le plus marqué des deux, pour ne pas multiplier les observations.
  if (stress && (!achievement || Math.abs(stress.difference) >= Math.abs(achievement.difference))) {
    return {
      id: "association",
      text: progressInsightTemplates.stressAssociation(stress),
      basis: `Basé sur ${days(stress.withCount)} avec un stress de ${ANALYTICS_THRESHOLDS.highStressMin}/10 ou plus et ${days(stress.withoutCount)} sans.`,
    };
  }
  if (!achievement) return null;
  const name = label(context.labels.achievements, achievement.slug);
  return {
    id: "association",
    text: progressInsightTemplates.achievementAssociation(name, achievement),
    basis: `Basé sur ${days(achievement.withCount)} avec « ${name} » et ${days(achievement.withoutCount)} sans.`,
  };
}

function weekdayInsight(context: InsightContext): DescriptiveInsight | null {
  const { highest, lowest } = calculateWeekdayCraving(context.current);
  if (!highest || !lowest || highest.average === null || lowest.average === null) return null;
  if (highest.average - lowest.average < ANALYTICS_THRESHOLDS.associationMinDifference) return null;
  return {
    id: "weekday",
    text: progressInsightTemplates.weekday(highest.name, highest.average, highest.count),
    basis: `Seuls les jours de la semaine avec au moins ${ANALYTICS_THRESHOLDS.weekdayMinCheckins} check-ins sont comparés ; le ${lowest.name} est à ${formatDecimal(lowest.average)} / 10.`,
  };
}

function achievementInsight(context: InsightContext): DescriptiveInsight | null {
  const top = calculateAchievementFrequency(context.current)[0];
  if (!top || top.days < PROGRESS_INSIGHT_RULES.frequencyMinDays) return null;
  return {
    id: "achievement",
    text: progressInsightTemplates.topAchievement(label(context.labels.achievements, top.slug), top.days),
    basis: `Basé sur ${days(context.current.length)} enregistrées.`,
  };
}

/**
 * Au plus 5 observations, dans l'ordre : évolution récente, déclencheurs, association
 * avec l'envie, jour de la semaine, accomplissements. Aucune sous 10 check-ins terminés
 * dans la période ; chaque règle applique en plus son propre seuil.
 */
export function generateProgressInsights(context: InsightContext): DescriptiveInsight[] {
  if (context.current.length < PROGRESS_INSIGHT_RULES.minCheckins) return [];
  return [
    evolutionInsight(context),
    triggerInsight(context),
    associationInsight(context),
    weekdayInsight(context),
    achievementInsight(context),
  ]
    .filter((insight): insight is DescriptiveInsight => insight !== null)
    .map((insight) => ({ ...insight, text: capitalize(insight.text) }))
    .slice(0, PROGRESS_INSIGHT_RULES.maxInsights);
}
