import { describe, expect, it } from "vitest";

import type { CheckinStatus } from "@/features/checkin/constants";
import { getPeriodStart as getJournalPeriodStart } from "@/features/journal/logic";
import {
  ANALYTICS_THRESHOLDS,
  calculateAchievementAssociations,
  calculateConsumptionSummary,
  calculateEmotionFrequency,
  calculateStatusDistribution,
  calculateStressCravingAssociation,
  calculateTriggerConsumptionShare,
  calculateTriggerFrequency,
  calculateWeekdayCraving,
  comparePeriods,
  getTrendDirection,
} from "@/features/progress/analytics";
import { formatPointDifference } from "@/features/progress/format";
import { calculateSobrietyMetrics } from "@/features/progress/metrics";
import {
  countRangeDays,
  DEFAULT_PROGRESS_PERIOD,
  getPeriodRange,
  getPreviousPeriodRange,
  isComparablePeriod,
  parseProgressPeriod,
} from "@/features/progress/periods";
import { buildProgressPage } from "@/features/progress/progress-page";
import {
  generateProgressInsights,
  PROGRESS_INSIGHT_RULES,
  progressInsightTemplates,
  type ProgressLabels,
} from "@/features/progress/progress-insights";
import type { ProgressCheckin } from "@/features/progress/types";
import { addDays, getMondayBasedWeekday, getUserToday } from "@/lib/dates";

const TODAY = "2026-09-24"; // jeudi

const LABELS: ProgressLabels = {
  triggers: { stress: "Stress", work: "Travail", loneliness: "Solitude" },
  emotions: { calm: "Calme", pride: "Fierté", fatigue: "Fatigue" },
  achievements: { exercise: "Activité physique", self_care: "Pris soin de moi" },
};

function checkin(date: string, status: CheckinStatus = "sober", overrides: Partial<ProgressCheckin> = {}): ProgressCheckin {
  return {
    date,
    status,
    mood: 6,
    energy: 6,
    stress: 5,
    craving: 4,
    triggers: [],
    achievements: [],
    emotions: [],
    consumptionEvents: [],
    ...overrides,
  };
}

/** `count` journées consécutives se terminant à `end`. */
function days(end: string, count: number, overrides: (index: number) => Partial<ProgressCheckin> = () => ({})) {
  return Array.from({ length: count }, (_, index) => {
    const date = addDays(end, index - count + 1);
    return checkin(date, "sober", overrides(index));
  });
}

const FORBIDDEN = /caus|risque|rechute|diagnos|excellent|mauvais|inquiétant|dépendance|%/i;

describe("périodes calendaires", () => {
  it.each([
    ["7d", "2026-09-18", 7],
    ["30d", "2026-08-26", 30],
    ["90d", "2026-06-27", 90],
    ["year", "2026-01-01", 267],
  ] as const)("%s : du %s à aujourd'hui (%i journées)", (period, start, count) => {
    const range = getPeriodRange(period, TODAY, "2025-03-01");
    expect(range).toEqual({ start, end: TODAY });
    expect(countRangeDays(range)).toBe(count);
  });

  it("« Tout » commence à la première journée enregistrée", () => {
    expect(getPeriodRange("all", TODAY, "2025-03-01")).toEqual({ start: "2025-03-01", end: TODAY });
    expect(getPeriodRange("all", TODAY, null)).toEqual({ start: TODAY, end: TODAY });
  });

  it("30 jours = 30 journées calendaires, pas 30 check-ins", () => {
    const sparse = [checkin("2026-08-25"), checkin("2026-08-26"), checkin("2026-09-10"), checkin(TODAY)];
    const page = buildProgressPage(TODAY, sparse, "30d", LABELS);
    expect(page.calendarDays).toBe(30);
    expect(page.metrics.trackedDays).toBe(3);
    expect(page.scorePoints).toHaveLength(30);
  });

  it("période précédente : les N journées immédiatement avant, sans chevauchement", () => {
    expect(getPreviousPeriodRange("30d", TODAY)).toEqual({ start: "2026-07-27", end: "2026-08-25" });
    expect(getPreviousPeriodRange("7d", TODAY)).toEqual({ start: "2026-09-11", end: "2026-09-17" });
    const current = getPeriodRange("90d", TODAY, null);
    const previous = getPreviousPeriodRange("90d", TODAY);
    expect(previous && addDays(previous.end, 1)).toBe(current.start);
    expect(previous && countRangeDays(previous)).toBe(90);
  });

  it("« Cette année » et « Tout » : pas de période précédente", () => {
    expect(getPreviousPeriodRange("year", TODAY)).toBeNull();
    expect(getPreviousPeriodRange("all", TODAY)).toBeNull();
    expect(isComparablePeriod("year")).toBe(false);
    expect(isComparablePeriod("7d")).toBe(true);
  });

  it("période lue depuis l'URL : 30 jours par défaut", () => {
    expect(DEFAULT_PROGRESS_PERIOD).toBe("30d");
    expect(parseProgressPeriod(undefined)).toBe("30d");
    expect(parseProgressPeriod("abc")).toBe("30d");
    expect(parseProgressPeriod("90d")).toBe("90d");
  });

  it("le journal utilise les mêmes bornes que la progression", () => {
    expect(getJournalPeriodStart("30d", TODAY)).toBe(getPeriodRange("30d", TODAY, null).start);
  });

  it("fuseau : « aujourd'hui » vient du profil, la période suit la journée locale", () => {
    // 1er janvier 2027 à 03 h UTC = 31 décembre 2026 au soir à Toronto.
    const instant = new Date("2027-01-01T03:00:00Z");
    expect(getPeriodRange("year", getUserToday("America/Toronto", instant), null).start).toBe("2026-01-01");
    expect(getPeriodRange("year", getUserToday("Europe/Paris", instant), null).start).toBe("2027-01-01");
  });

  it("minuit et changement de mois : la période glisse d'une journée entière", () => {
    const beforeMidnight = getUserToday("America/Toronto", new Date("2026-10-01T03:59:00Z"));
    const afterMidnight = getUserToday("America/Toronto", new Date("2026-10-01T04:01:00Z"));
    expect(beforeMidnight).toBe("2026-09-30");
    expect(afterMidnight).toBe("2026-10-01");
    expect(getPeriodRange("7d", afterMidnight, null).start).toBe("2026-09-25");
  });

  it("changement d'heure : 30 journées calendaires, même si la période ne dure pas 720 heures", () => {
    // Retour à l'heure normale à Toronto le 1er novembre 2026.
    const today = getUserToday("America/Toronto", new Date("2026-11-15T17:00:00Z"));
    const range = getPeriodRange("30d", today, null);
    expect(range).toEqual({ start: "2026-10-17", end: "2026-11-15" });
    expect(countRangeDays(range)).toBe(30);
    // Passage à l'heure d'été (8 mars 2026) : aucune journée perdue ni dupliquée.
    const spring = getPeriodRange("7d", "2026-03-11", null);
    expect(spring.start).toBe("2026-03-05");
    expect(countRangeDays(spring)).toBe(7);
  });
});

describe("métriques de la période", () => {
  it("réutilise calculateSobrietyMetrics : mêmes définitions que le tableau de bord", () => {
    const list = [checkin("2026-09-20"), checkin("2026-09-21", "sober_with_craving"), checkin("2026-09-22", "consumed")];
    const page = buildProgressPage(TODAY, list, "7d", LABELS);
    expect(page.metrics).toEqual(calculateSobrietyMetrics(list));
    expect(page.metrics).toMatchObject({ trackedDays: 3, soberDays: 2, consumedDays: 1 });
  });

  it("journées manquantes : ni sobres, ni consommées, hors taux, jamais un score 0", () => {
    const list = [checkin("2026-09-18", "sober", { stress: 7 }), checkin("2026-09-20", "sober", { stress: 4 })];
    const page = buildProgressPage(TODAY, list, "7d", LABELS);
    expect(page.metrics).toMatchObject({ trackedDays: 2, soberDays: 2, consumedDays: 0, sobrietyRate: 100 });
    expect(page.scorePoints.map((point) => point.stress)).toEqual([7, null, 4, null, null, null, null]);
    expect(page.scoreTrends.find((trend) => trend.key === "stress")?.current).toBe(5.5);
  });

  it("série de scores : 7 → absence → 4, jamais 7 → 0 → 4", () => {
    const list = [checkin("2026-09-21", "sober", { stress: 7 }), checkin("2026-09-23", "sober", { stress: 4 })];
    const points = buildProgressPage("2026-09-23", list, "7d", LABELS).scorePoints.slice(-3);
    expect(points.map((point) => point.stress)).toEqual([7, null, 4]);
  });

  it("« Depuis le début » couvre tout le parcours, indépendamment de la période", () => {
    const list = [...days("2026-06-30", 20), ...days(TODAY, 5)];
    const page = buildProgressPage(TODAY, list, "7d", LABELS);
    expect(page.metrics.trackedDays).toBe(5);
    expect(page.allTime.metrics.trackedDays).toBe(25);
    expect(page.allTime.streaks.best).toBe(25);
  });

  it("aucune journée future n'est prise en compte", () => {
    const page = buildProgressPage(TODAY, [checkin(TODAY), checkin(addDays(TODAY, 1))], "all", LABELS);
    expect(page.allTime.metrics.trackedDays).toBe(1);
  });

  it("répartition des statuts dérivée des métriques", () => {
    const list = [
      ...days("2026-09-10", 18),
      ...days("2026-09-16", 6).map((item) => ({ ...item, status: "sober_with_craving" as const })),
      checkin("2026-09-20", "consumed"),
      checkin("2026-09-21", "consumed"),
      checkin("2026-09-22", "consumed"),
    ];
    const distribution = calculateStatusDistribution(list);
    expect(distribution.challenging).toBe(6);
    expect(distribution.consumed).toBe(3);
    expect(distribution.sober + distribution.challenging).toBe(calculateSobrietyMetrics(list).soberDays);
  });
});

describe("comparaison de périodes", () => {
  it("moins de 3 check-ins dans une période : aucune variation affichée", () => {
    const comparison = comparePeriods([checkin("2026-09-20")], days("2026-08-20", 2));
    expect(comparison.sufficient).toBe(false);
    expect(comparison.scores.every((score) => score.difference === null)).toBe(true);
    expect(comparison.trackedDays).toBeNull();
  });

  it("stress 4,2 vs 5,4 → −1,2 point (jamais en pourcentage)", () => {
    const current = [3, 4, 5, 4, 5].map((stress, index) => checkin(addDays("2026-09-01", index), "sober", { stress }));
    const previous = [5, 6, 5, 5, 6].map((stress, index) => checkin(addDays("2026-08-01", index), "sober", { stress }));
    const stress = comparePeriods(current, previous).scores.find((score) => score.key === "stress");
    expect(stress?.current).toBeCloseTo(4.2);
    expect(stress?.previous).toBeCloseTo(5.4);
    expect(stress?.difference).toBeCloseTo(-1.2);
    expect(stress?.direction).toBe("down");
    expect(formatPointDifference(stress?.difference ?? 0)).toBe("−1,2 point");
    expect(formatPointDifference(2.04)).toBe("+2 points");
  });

  it("4,2 vs 4,4 avec une tolérance de 0,5 → relativement stable", () => {
    expect(ANALYTICS_THRESHOLDS.stableTolerance).toBe(0.5);
    expect(getTrendDirection(4.2 - 4.4)).toBe("stable");
    expect(getTrendDirection(0.6)).toBe("up");
  });

  it("jours suivis comparés (22 vs 18)", () => {
    const comparison = comparePeriods(days(TODAY, 22), days("2026-08-20", 18));
    expect(comparison.trackedDays).toEqual({ current: 22, previous: 18, difference: 4, direction: "up" });
  });

  it("page : comparaison seulement pour 7, 30 et 90 jours", () => {
    const list = [...days("2026-08-20", 10), ...days(TODAY, 10)];
    expect(buildProgressPage(TODAY, list, "30d", LABELS).comparison?.sufficient).toBe(true);
    expect(buildProgressPage(TODAY, list, "year", LABELS).comparison).toBeNull();
    expect(buildProgressPage(TODAY, list, "all", LABELS).comparison).toBeNull();
  });
});

describe("fréquences", () => {
  it("stress enregistré 5 journées → 5 journées, même avec un doublon relationnel", () => {
    const list = days(TODAY, 5, (index) => ({ triggers: index === 0 ? ["stress", "stress"] : ["stress"] }));
    expect(calculateTriggerFrequency(list)).toEqual([{ slug: "stress", days: 5 }]);
  });

  it("tri par nombre de journées décroissant", () => {
    const list = days(TODAY, 4, (index) => ({ emotions: index < 3 ? ["calm", "pride"] : ["calm"] }));
    expect(calculateEmotionFrequency(list)).toEqual([
      { slug: "calm", days: 4 },
      { slug: "pride", days: 3 },
    ]);
  });
});

describe("associations avec l'envie", () => {
  it("activité physique : 6 journées à 3 vs 8 journées à 5 → observation possible", () => {
    const list = [
      ...days("2026-09-06", 6, () => ({ achievements: ["exercise"], craving: 3 })),
      ...days(TODAY, 8, () => ({ craving: 5 })),
    ];
    const [association] = calculateAchievementAssociations(list);
    expect(association).toMatchObject({ slug: "exercise", withAverage: 3, withCount: 6, withoutAverage: 5, withoutCount: 8 });
  });

  it("écart < 1 point → aucune observation", () => {
    const list = [
      ...days("2026-09-06", 6, () => ({ achievements: ["exercise"], craving: 4.5 })),
      ...days(TODAY, 8, () => ({ craving: 5 })),
    ];
    expect(calculateAchievementAssociations(list)).toEqual([]);
  });

  it("moins de 5 journées dans un groupe → aucune observation", () => {
    const list = [
      ...days("2026-09-06", 4, () => ({ achievements: ["exercise"], craving: 1 })),
      ...days(TODAY, 8, () => ({ craving: 8 })),
    ];
    expect(calculateAchievementAssociations(list)).toEqual([]);
  });

  it("stress ≥ 7 vs autres journées", () => {
    const list = [
      ...days("2026-09-06", 5, () => ({ stress: 8, craving: 6 })),
      ...days(TODAY, 6, () => ({ stress: 3, craving: 3 })),
    ];
    expect(calculateStressCravingAssociation(list)).toMatchObject({ withAverage: 6, withCount: 5, withoutAverage: 3 });
  });
});

describe("jours de la semaine", () => {
  it("un vendredi avec une seule observation n'est jamais déclaré le plus élevé", () => {
    // 3 lundis à 4, 3 mardis à 2, 1 vendredi à 10.
    const mondays = ["2026-09-07", "2026-09-14", "2026-09-21"].map((date) => checkin(date, "sober", { craving: 4 }));
    const tuesdays = ["2026-09-08", "2026-09-15", "2026-09-22"].map((date) => checkin(date, "sober", { craving: 2 }));
    const friday = checkin("2026-09-18", "sober", { craving: 10 });
    expect(getMondayBasedWeekday("2026-09-18")).toBe(4);
    const summary = calculateWeekdayCraving([...mondays, ...tuesdays, friday]);
    expect(summary.days[4]).toMatchObject({ name: "vendredi", count: 1, eligible: false });
    expect(summary.highest?.name).toBe("lundi");
    expect(summary.lowest?.name).toBe("mardi");
  });

  it("un seul jour éligible : aucune comparaison", () => {
    const mondays = ["2026-09-07", "2026-09-14", "2026-09-21"].map((date) => checkin(date));
    expect(calculateWeekdayCraving(mondays).highest).toBeNull();
  });
});

describe("consommation", () => {
  const cannabis = { substanceId: "sub-cannabis" };
  const alcohol = { substanceId: "sub-alcohol" };

  it("3 journées avec consommation, 5 événements", () => {
    const list = [
      checkin("2026-09-20", "consumed", { consumptionEvents: [cannabis, cannabis] }),
      checkin("2026-09-21", "consumed", { consumptionEvents: [cannabis, alcohol] }),
      checkin("2026-09-22", "consumed", { consumptionEvents: [cannabis] }),
      checkin("2026-09-23"),
    ];
    const summary = calculateConsumptionSummary(list);
    expect(summary.consumedDays).toBe(3);
    expect(summary.events).toBe(5);
  });

  it("plusieurs substances : répartition séparée, aucune somme de quantités", () => {
    const list = [
      checkin("2026-09-19", "consumed", { consumptionEvents: [cannabis, cannabis] }),
      checkin("2026-09-20", "consumed", { consumptionEvents: [cannabis, alcohol] }),
      checkin("2026-09-21", "consumed", { consumptionEvents: [cannabis] }),
    ];
    const summary = calculateConsumptionSummary(list);
    expect(summary.bySubstance).toEqual([
      { substanceId: "sub-cannabis", events: 4, days: 3 },
      { substanceId: "sub-alcohol", events: 1, days: 1 },
    ]);
    expect(Object.keys(summary)).not.toContain("quantity");
  });

  it("déclencheur présent dans 5 des 7 journées avec consommation", () => {
    const list = days(TODAY, 7, (index) => ({ triggers: index < 5 ? ["stress"] : ["work"] })).map((item) => ({
      ...item,
      status: "consumed" as const,
    }));
    const share = calculateTriggerConsumptionShare(calculateConsumptionSummary(list));
    expect(share).toEqual({ slug: "stress", days: 5, consumedDays: 7 });
    expect(progressInsightTemplates.triggerConsumption("Stress", 5, 7)).toBe(
      "« Stress » apparaît dans 5 de tes 7 journées avec consommation enregistrées.",
    );
  });

  it("moins de 3 journées avec consommation : pas d'analyse des déclencheurs", () => {
    const list = [checkin("2026-09-20", "consumed", { triggers: ["stress"] }), checkin("2026-09-21", "consumed", { triggers: ["stress"] })];
    expect(calculateTriggerConsumptionShare(calculateConsumptionSummary(list))).toBeNull();
  });
});

describe("observations (Progression)", () => {
  /** 14 journées riches : stress 8 → envie 7 (6 j), stress 3 → envie 2 (8 j), activité les jours calmes. */
  function richPeriod(end: string) {
    return days(end, 14, (index) =>
      index < 6
        ? { stress: 8, craving: 7, triggers: ["stress"], achievements: [] }
        : { stress: 3, craving: 2, triggers: ["work"], achievements: ["exercise"] },
    );
  }

  it("9 check-ins → aucune observation ; 10 → possible", () => {
    const nine = days(TODAY, 9, (index) => ({ triggers: ["stress"], craving: index % 2 ? 8 : 1 }));
    expect(generateProgressInsights({ current: nine, previous: null, periodLabel: "30 derniers jours", labels: LABELS })).toEqual([]);
    const ten = days(TODAY, 10, () => ({ triggers: ["stress"] }));
    const insights = generateProgressInsights({ current: ten, previous: null, periodLabel: "30 derniers jours", labels: LABELS });
    expect(insights.map((insight) => insight.id)).toContain("trigger");
    expect(PROGRESS_INSIGHT_RULES.minCheckins).toBe(10);
  });

  it("au plus 5, dans l'ordre : évolution, déclencheurs, association, jour de semaine, accomplissements", () => {
    const current = [...richPeriod(TODAY), ...days("2026-09-10", 7, (index) => ({ stress: 3, craving: index < 3 ? 6 : 2, achievements: ["exercise"] }))];
    const previous = days("2026-08-20", 10, () => ({ stress: 3, craving: 1 }));
    const insights = generateProgressInsights({ current, previous, periodLabel: "30 derniers jours", labels: LABELS });
    expect(insights.length).toBeLessThanOrEqual(5);
    const order = ["evolution", "trigger", "association", "weekday", "achievement"];
    const ids = insights.map((insight) => insight.id);
    expect(ids).toEqual([...ids].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
    expect(ids).toContain("association");
  });

  it("formulations descriptives : jamais de cause, de risque, de note ni de pourcentage", () => {
    const current = richPeriod(TODAY);
    const previous = days("2026-09-03", 7, () => ({ craving: 1, stress: 2 }));
    const insights = generateProgressInsights({ current, previous, periodLabel: "7 derniers jours", labels: LABELS });
    expect(insights.length).toBeGreaterThan(0);
    for (const insight of insights) {
      expect(insight.text).not.toMatch(FORBIDDEN);
      expect(insight.basis.length).toBeGreaterThan(0);
    }
  });

  it("état « période plus longue » quand le parcours compte assez de check-ins mais pas la période", () => {
    const list = [...days("2026-08-01", 20), ...days(TODAY, 3)];
    expect(buildProgressPage(TODAY, list, "7d", LABELS).insightsState).toBe("longer_period");
    expect(buildProgressPage(TODAY, days(TODAY, 4), "7d", LABELS).insightsState).toBe("collecting");
  });
});
