import { calculateSobrietyMetrics } from "@/features/progress/metrics";
import { average, type ScoreSeriesKey } from "@/features/progress/scores";
import type { ProgressCheckin } from "@/features/progress/types";
import { getMondayBasedWeekday } from "@/lib/dates";

/*
 * Analyses descriptives de la page Progression (ADR-053, ADR-054). Fonctions pures,
 * calculées uniquement à partir des check-ins TERMINÉS de la période. Une journée sans
 * check-in n'entre dans aucun calcul (ni zéro, ni moyenne). Aucune de ces fonctions
 * n'établit de cause : elles comptent et comparent des moyennes.
 */

/**
 * Seuils documentés (docs/DECISIONS.md, ADR-054). Toute analyse qui ne les atteint
 * pas n'affiche aucun chiffre comparatif.
 */
export const ANALYTICS_THRESHOLDS = {
  /** Comparaison numérique période actuelle / précédente : check-ins minimaux dans CHAQUE période. */
  comparisonMinCheckins: 3,
  /** Écart absolu (points sur 10) en dessous duquel un score est « relativement stable ». */
  stableTolerance: 0.5,
  /** Association « avec / sans » (accomplissement, stress élevé) : journées minimales par groupe. */
  associationMinGroupSize: 5,
  /** Écart minimal (points sur 10) pour qu'une association soit décrite. */
  associationMinDifference: 1,
  /** Stress « élevé » : score de stress supérieur ou égal à ce seuil. */
  highStressMin: 7,
  /** Jour de la semaine : check-ins minimaux pour qu'un jour participe à une comparaison. */
  weekdayMinCheckins: 3,
  /** Déclencheurs et consommation : journées avec consommation minimales dans la période. */
  triggerConsumptionMinDays: 3,
  /** Nombre d'éléments affichés d'emblée dans les listes de fréquences. */
  topItems: 5,
} as const;

export const SCORE_KEYS = ["mood", "energy", "stress", "craving"] as const satisfies readonly ScoreSeriesKey[];

// ---------------------------------------------------------------------------
// Scores et comparaison de périodes
// ---------------------------------------------------------------------------

export type TrendDirection = "up" | "down" | "stable";

/** Hausse, baisse ou relativement stable (tolérance en points) — jamais « bon » ou « mauvais ». */
export function getTrendDirection(difference: number, tolerance: number = ANALYTICS_THRESHOLDS.stableTolerance): TrendDirection {
  if (Math.abs(difference) < tolerance) return "stable";
  return difference > 0 ? "up" : "down";
}

export type ScoreTrend = {
  key: ScoreSeriesKey;
  /** Moyenne sur la période actuelle (null sans donnée) */
  current: number | null;
  /** Moyenne sur la période précédente (null si non comparable ou sans donnée) */
  previous: number | null;
  /** Différence en POINTS sur 10 (jamais en %), seulement si la comparaison est fiable */
  difference: number | null;
  direction: TrendDirection | null;
};

export type PeriodComparison = {
  /** Faux si l'une des périodes a moins de `comparisonMinCheckins` check-ins */
  sufficient: boolean;
  currentCount: number;
  previousCount: number;
  scores: ScoreTrend[];
  /** Jours suivis : différence en nombre de journées */
  trackedDays: { current: number; previous: number; difference: number; direction: TrendDirection } | null;
};

function scoreAverage(checkins: readonly ProgressCheckin[], key: ScoreSeriesKey): number | null {
  return average(checkins.map((checkin) => checkin[key]));
}

/** Moyennes des quatre scores sur une liste de check-ins. */
export function calculateScoreTrends(current: readonly ProgressCheckin[]): ScoreTrend[] {
  return SCORE_KEYS.map((key) => ({ key, current: scoreAverage(current, key), previous: null, difference: null, direction: null }));
}

/**
 * Période actuelle vs précédente. Les différences ne sont calculées que si CHAQUE
 * période compte au moins `comparisonMinCheckins` check-ins terminés.
 */
export function comparePeriods(current: readonly ProgressCheckin[], previous: readonly ProgressCheckin[]): PeriodComparison {
  const sufficient =
    current.length >= ANALYTICS_THRESHOLDS.comparisonMinCheckins &&
    previous.length >= ANALYTICS_THRESHOLDS.comparisonMinCheckins;

  const scores = SCORE_KEYS.map((key): ScoreTrend => {
    const currentAverage = scoreAverage(current, key);
    const previousAverage = scoreAverage(previous, key);
    if (!sufficient || currentAverage === null || previousAverage === null) {
      return { key, current: currentAverage, previous: sufficient ? previousAverage : null, difference: null, direction: null };
    }
    const difference = currentAverage - previousAverage;
    return { key, current: currentAverage, previous: previousAverage, difference, direction: getTrendDirection(difference) };
  });

  const trackedDifference = current.length - previous.length;
  return {
    sufficient,
    currentCount: current.length,
    previousCount: previous.length,
    scores,
    trackedDays: sufficient
      ? {
          current: current.length,
          previous: previous.length,
          difference: trackedDifference,
          direction: getTrendDirection(trackedDifference, 1),
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Fréquences (déclencheurs, émotions, accomplissements)
// ---------------------------------------------------------------------------

export type FrequencyField = "triggers" | "emotions" | "achievements";

/** Nombre de JOURNÉES où un élément a été enregistré (un doublon dans une journée compte une fois). */
export type Frequency = { slug: string; days: number };
export type TriggerFrequency = Frequency;
export type EmotionFrequency = Frequency;
export type AchievementFrequency = Frequency;

export function calculateFrequency(checkins: readonly ProgressCheckin[], field: FrequencyField): Frequency[] {
  const counts = new Map<string, number>();
  for (const checkin of checkins) {
    for (const slug of new Set(checkin[field])) counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([slug, days]) => ({ slug, days }))
    .sort((a, b) => b.days - a.days || a.slug.localeCompare(b.slug));
}

export const calculateTriggerFrequency = (checkins: readonly ProgressCheckin[]): TriggerFrequency[] =>
  calculateFrequency(checkins, "triggers");
export const calculateEmotionFrequency = (checkins: readonly ProgressCheckin[]): EmotionFrequency[] =>
  calculateFrequency(checkins, "emotions");
export const calculateAchievementFrequency = (checkins: readonly ProgressCheckin[]): AchievementFrequency[] =>
  calculateFrequency(checkins, "achievements");

// ---------------------------------------------------------------------------
// Associations « avec / sans » (envie moyenne)
// ---------------------------------------------------------------------------

export type CravingAssociation = {
  /** Envie moyenne des journées AVEC la caractéristique */
  withAverage: number;
  withCount: number;
  /** Envie moyenne des AUTRES journées enregistrées */
  withoutAverage: number;
  withoutCount: number;
  difference: number;
};

/**
 * Envie moyenne des journées avec / sans une caractéristique. null si l'un des groupes
 * a moins de `associationMinGroupSize` journées ou si l'écart est inférieur à
 * `associationMinDifference` point : pas d'observation insignifiante.
 */
export function compareCravingByFeature(
  checkins: readonly ProgressCheckin[],
  hasFeature: (checkin: ProgressCheckin) => boolean,
): CravingAssociation | null {
  const scored = checkins.filter((checkin) => checkin.craving !== null);
  const withGroup = scored.filter(hasFeature);
  const withoutGroup = scored.filter((checkin) => !hasFeature(checkin));
  const { associationMinGroupSize, associationMinDifference } = ANALYTICS_THRESHOLDS;
  if (withGroup.length < associationMinGroupSize || withoutGroup.length < associationMinGroupSize) return null;

  const withAverage = scoreAverage(withGroup, "craving");
  const withoutAverage = scoreAverage(withoutGroup, "craving");
  if (withAverage === null || withoutAverage === null) return null;
  const difference = withAverage - withoutAverage;
  if (Math.abs(difference) < associationMinDifference) return null;
  return { withAverage, withCount: withGroup.length, withoutAverage, withoutCount: withoutGroup.length, difference };
}

export type AchievementAssociation = CravingAssociation & { slug: string };

/** Accomplissements dont les journées sont associées à une envie moyenne différente (écart décroissant). */
export function calculateAchievementAssociations(checkins: readonly ProgressCheckin[]): AchievementAssociation[] {
  return calculateAchievementFrequency(checkins)
    .map(({ slug }) => {
      const association = compareCravingByFeature(checkins, (checkin) => checkin.achievements.includes(slug));
      return association ? { ...association, slug } : null;
    })
    .filter((association): association is AchievementAssociation => association !== null)
    .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
}

/** Envie moyenne les journées de stress élevé (≥ highStressMin) vs les autres. */
export function calculateStressCravingAssociation(checkins: readonly ProgressCheckin[]): CravingAssociation | null {
  const scored = checkins.filter((checkin) => checkin.stress !== null);
  return compareCravingByFeature(scored, (checkin) => (checkin.stress ?? 0) >= ANALYTICS_THRESHOLDS.highStressMin);
}

// ---------------------------------------------------------------------------
// Jours de la semaine
// ---------------------------------------------------------------------------

export const WEEKDAY_NAMES = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"] as const;

export type WeekdayCraving = {
  /** 0 = lundi … 6 = dimanche */
  weekday: number;
  name: (typeof WEEKDAY_NAMES)[number];
  count: number;
  average: number | null;
  /** Vrai si le jour a assez d'observations pour participer à une comparaison */
  eligible: boolean;
};

export type WeekdayCravingSummary = {
  days: WeekdayCraving[];
  /** Jour éligible à l'envie moyenne la plus élevée, si au moins deux jours sont éligibles */
  highest: WeekdayCraving | null;
  /** Jour éligible à l'envie moyenne la plus faible */
  lowest: WeekdayCraving | null;
};

export function calculateWeekdayCraving(checkins: readonly ProgressCheckin[]): WeekdayCravingSummary {
  const groups = WEEKDAY_NAMES.map(() => [] as number[]);
  for (const checkin of checkins) {
    if (checkin.craving !== null) groups[getMondayBasedWeekday(checkin.date)].push(checkin.craving);
  }

  const days = groups.map((values, weekday): WeekdayCraving => ({
    weekday,
    name: WEEKDAY_NAMES[weekday],
    count: values.length,
    average: average(values),
    eligible: values.length >= ANALYTICS_THRESHOLDS.weekdayMinCheckins,
  }));

  const eligible = days.filter((day) => day.eligible && day.average !== null);
  if (eligible.length < 2) return { days, highest: null, lowest: null };
  const sorted = [...eligible].sort((a, b) => (b.average ?? 0) - (a.average ?? 0) || a.weekday - b.weekday);
  return { days, highest: sorted[0], lowest: sorted[sorted.length - 1] };
}

// ---------------------------------------------------------------------------
// Consommation
// ---------------------------------------------------------------------------

export type SubstanceEventCount = { substanceId: string; events: number; days: number };

export type ConsumptionSummary = {
  /** Journées dont le statut est « consommation » (une journée, quel que soit le nombre d'événements) */
  consumedDays: number;
  /** Événements de consommation enregistrés (peut différer du nombre de journées) */
  events: number;
  /** Répartition par substance suivie — jamais de somme des quantités */
  bySubstance: SubstanceEventCount[];
  /** Déclencheurs enregistrés les journées avec consommation */
  triggers: TriggerFrequency[];
  /** Envie moyenne les journées avec consommation */
  averageCraving: number | null;
};

export function calculateConsumptionSummary(checkins: readonly ProgressCheckin[]): ConsumptionSummary {
  const consumed = checkins.filter((checkin) => checkin.status === "consumed");
  const bySubstance = new Map<string, SubstanceEventCount>();
  let events = 0;

  for (const checkin of consumed) {
    const substancesThisDay = new Set<string>();
    for (const event of checkin.consumptionEvents) {
      events += 1;
      const entry = bySubstance.get(event.substanceId) ?? { substanceId: event.substanceId, events: 0, days: 0 };
      entry.events += 1;
      if (!substancesThisDay.has(event.substanceId)) {
        entry.days += 1;
        substancesThisDay.add(event.substanceId);
      }
      bySubstance.set(event.substanceId, entry);
    }
  }

  return {
    consumedDays: consumed.length,
    events,
    bySubstance: [...bySubstance.values()].sort((a, b) => b.events - a.events || a.substanceId.localeCompare(b.substanceId)),
    triggers: calculateTriggerFrequency(consumed),
    averageCraving: scoreAverage(consumed, "craving"),
  };
}

export type TriggerConsumptionShare = { slug: string; days: number; consumedDays: number };

/**
 * Déclencheur le plus présent les journées avec consommation (« apparaît dans 5 de tes
 * 7 journées avec consommation »), seulement avec assez de journées et s'il revient au
 * moins deux fois. Description d'une fréquence, jamais d'une cause.
 */
export function calculateTriggerConsumptionShare(summary: ConsumptionSummary): TriggerConsumptionShare | null {
  if (summary.consumedDays < ANALYTICS_THRESHOLDS.triggerConsumptionMinDays) return null;
  const top = summary.triggers[0];
  if (!top || top.days < 2) return null;
  return { slug: top.slug, days: top.days, consumedDays: summary.consumedDays };
}

// ---------------------------------------------------------------------------
// Répartition des statuts
// ---------------------------------------------------------------------------

export type StatusDistribution = { sober: number; challenging: number; consumed: number; total: number };

/**
 * Dérivée de calculateSobrietyMetrics() (aucune deuxième définition) : « sobre » ici =
 * sobre SANS forte envie ; « sobre malgré une forte envie » est affiché à part mais
 * reste une journée sobre.
 */
export function calculateStatusDistribution(checkins: readonly ProgressCheckin[]): StatusDistribution {
  const metrics = calculateSobrietyMetrics(checkins);
  return {
    sober: metrics.soberDays - metrics.challengingDays,
    challenging: metrics.challengingDays,
    consumed: metrics.consumedDays,
    total: metrics.trackedDays,
  };
}
