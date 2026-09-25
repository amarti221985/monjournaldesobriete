import { formatScore } from "@/features/progress/format";
import { average } from "@/features/progress/scores";
import { sortByDate, type ProgressCheckin } from "@/features/progress/types";
import { formatLocalDate, getMondayBasedWeekday } from "@/lib/dates";

/*
 * Tendances descriptives (ADR-045) — PAS d'IA : quelques règles simples, calculées
 * uniquement à partir des check-ins terminés de l'utilisateur, avec des seuils
 * minimums. Formulations centralisées ici : descriptives, jamais causales, jamais
 * médicales (vérifié par les tests).
 */

export const INSIGHT_RULES = {
  /** En dessous : aucune observation (« Tes tendances arrivent bientôt »). */
  minCheckins: 7,
  maxInsights: 3,
  /** 7 derniers check-ins vs 7 précédents ; écart minimal sur l'échelle /10. */
  evolution: { minCheckins: 14, window: 7, minDifference: 1 },
  /** Jours avec vs sans un déclencheur / accomplissement : effectif minimal par groupe. */
  comparison: { minCheckins: 10, minGroupSize: 3, minDifference: 1.5 },
  /** Jour de la semaine : observations minimales pour ce jour, écart à la moyenne globale. */
  weekday: { minCheckins: 14, minPerWeekday: 3, minDifference: 1.5 },
} as const;

export type Insight = {
  id: "evolution" | "stress_trigger" | "physical_activity" | "weekday";
  text: string;
};

type ScoreField = "mood" | "stress" | "craving";

const EVOLUTION_LABELS: Record<ScoreField, string> = {
  stress: "Ton stress moyen est passé",
  craving: "Ton envie moyenne est passée",
  mood: "Ton humeur moyenne est passée",
};

/** Modèles de phrases (seul endroit où le texte des tendances est construit). */
export const insightTemplates = {
  evolution: (field: ScoreField, before: number, after: number) =>
    `${EVOLUTION_LABELS[field]} de ${formatScore(before)} à ${formatScore(after)} sur tes 7 derniers check-ins, par rapport aux 7 précédents.`,
  stressTrigger: (withStress: number, withoutStress: number) =>
    `Dans tes données, ton envie moyenne a été ${withStress > withoutStress ? "plus élevée" : "plus faible"} les jours où tu as indiqué le stress comme déclencheur (${formatScore(withStress)} contre ${formatScore(withoutStress)}).`,
  physicalActivity: (withActivity: number, withoutActivity: number) =>
    `Dans tes données, les journées où tu as indiqué une activité physique sont associées à une envie moyenne ${withActivity < withoutActivity ? "plus faible" : "plus élevée"} (${formatScore(withActivity)} contre ${formatScore(withoutActivity)}).`,
  weekday: (weekdayName: string, value: number, count: number) =>
    `Dans tes données, le ${weekdayName} est le jour de la semaine où ton envie moyenne est la plus élevée (${formatScore(value)}, sur ${count} ${weekdayName}s enregistrés).`,
};

function evolutionInsight(sorted: ProgressCheckin[]): Insight | null {
  const { minCheckins, window, minDifference } = INSIGHT_RULES.evolution;
  if (sorted.length < minCheckins) return null;

  const recent = sorted.slice(-window);
  const previous = sorted.slice(-2 * window, -window);
  let best: { field: ScoreField; before: number; after: number } | null = null;

  for (const field of ["stress", "craving", "mood"] as const) {
    const before = average(previous.map((checkin) => checkin[field]));
    const after = average(recent.map((checkin) => checkin[field]));
    if (before === null || after === null || Math.abs(after - before) < minDifference) continue;
    if (!best || Math.abs(after - before) > Math.abs(best.after - best.before)) {
      best = { field, before, after };
    }
  }

  return best ? { id: "evolution", text: insightTemplates.evolution(best.field, best.before, best.after) } : null;
}

/** Envie moyenne des journées avec / sans une caractéristique, si les deux groupes sont assez grands. */
function compareCraving(
  checkins: readonly ProgressCheckin[],
  hasFeature: (checkin: ProgressCheckin) => boolean,
): { withFeature: number; withoutFeature: number } | null {
  const { minCheckins, minGroupSize, minDifference } = INSIGHT_RULES.comparison;
  if (checkins.length < minCheckins) return null;

  const withGroup = checkins.filter(hasFeature).map((checkin) => checkin.craving);
  const withoutGroup = checkins.filter((checkin) => !hasFeature(checkin)).map((checkin) => checkin.craving);
  const withFeature = average(withGroup);
  const withoutFeature = average(withoutGroup);
  const withCount = withGroup.filter((value) => value !== null).length;
  const withoutCount = withoutGroup.filter((value) => value !== null).length;

  if (withFeature === null || withoutFeature === null) return null;
  if (withCount < minGroupSize || withoutCount < minGroupSize) return null;
  if (Math.abs(withFeature - withoutFeature) < minDifference) return null;
  return { withFeature, withoutFeature };
}

function weekdayInsight(checkins: readonly ProgressCheckin[]): Insight | null {
  const { minCheckins, minPerWeekday, minDifference } = INSIGHT_RULES.weekday;
  if (checkins.length < minCheckins) return null;

  const overall = average(checkins.map((checkin) => checkin.craving));
  if (overall === null) return null;

  const byWeekday = new Map<number, ProgressCheckin[]>();
  for (const checkin of checkins) {
    if (checkin.craving === null) continue;
    const weekday = getMondayBasedWeekday(checkin.date);
    byWeekday.set(weekday, [...(byWeekday.get(weekday) ?? []), checkin]);
  }

  let top: { sample: ProgressCheckin; value: number; count: number } | null = null;
  for (const group of byWeekday.values()) {
    if (group.length < minPerWeekday) continue;
    const value = average(group.map((checkin) => checkin.craving));
    if (value !== null && (!top || value > top.value)) top = { sample: group[0], value, count: group.length };
  }

  if (!top || top.value - overall < minDifference) return null;
  const weekdayName = formatLocalDate(top.sample.date, { weekday: "long" });
  return { id: "weekday", text: insightTemplates.weekday(weekdayName, top.value, top.count) };
}

/**
 * Au plus 3 observations, par ordre de lisibilité : évolution récente, stress,
 * activité physique, jour de la semaine. Aucune si moins de 7 check-ins terminés.
 */
export function generateDescriptiveInsights(checkins: readonly ProgressCheckin[]): Insight[] {
  if (checkins.length < INSIGHT_RULES.minCheckins) return [];
  const sorted = sortByDate(checkins);
  const insights: Insight[] = [];

  const evolution = evolutionInsight(sorted);
  if (evolution) insights.push(evolution);

  const stress = compareCraving(sorted, (checkin) => checkin.triggers.includes("stress"));
  if (stress) {
    insights.push({ id: "stress_trigger", text: insightTemplates.stressTrigger(stress.withFeature, stress.withoutFeature) });
  }

  const activity = compareCraving(sorted, (checkin) => checkin.achievements.includes("exercise"));
  if (activity) {
    insights.push({
      id: "physical_activity",
      text: insightTemplates.physicalActivity(activity.withFeature, activity.withoutFeature),
    });
  }

  const weekday = weekdayInsight(sorted);
  if (weekday) insights.push(weekday);

  return insights.slice(0, INSIGHT_RULES.maxInsights);
}
