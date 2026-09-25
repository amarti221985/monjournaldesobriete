import { describe, expect, it } from "vitest";

import type { CheckinStatus } from "@/features/checkin/constants";
import { buildDashboard } from "@/features/progress/dashboard";
import { formatDecimal, formatPercent, formatScore } from "@/features/progress/format";
import { generateDescriptiveInsights, insightTemplates, INSIGHT_RULES } from "@/features/progress/insights";
import { calculateSobrietyMetrics, calculateStreaks } from "@/features/progress/metrics";
import { average, buildScoreSeries, calculateScoreAverages } from "@/features/progress/scores";
import type { ProgressCheckin } from "@/features/progress/types";
import { buildCurrentWeek, calculateRecentDaysSummary } from "@/features/progress/week";
import { addDays, getUserToday, getWeekStart } from "@/lib/dates";

const S: CheckinStatus = "sober";
const W: CheckinStatus = "sober_with_craving";
const C: CheckinStatus = "consumed";

function checkin(date: string, status: CheckinStatus, overrides: Partial<ProgressCheckin> = {}): ProgressCheckin {
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

/** Suite de journées consécutives à partir d'une date. */
function sequence(start: string, statuses: CheckinStatus[]): ProgressCheckin[] {
  return statuses.map((status, index) => checkin(addDays(start, index), status));
}

// Lundi 21 septembre 2026
const MONDAY = "2026-09-21";

describe("métriques de sobriété", () => {
  it("aucun check-in : aucun taux artificiel", () => {
    expect(calculateSobrietyMetrics([])).toEqual({
      trackedDays: 0,
      soberDays: 0,
      challengingDays: 0,
      consumedDays: 0,
      sobrietyRate: null,
    });
  });

  it("5 journées sobres → 5 jours sobres, 100 %", () => {
    const metrics = calculateSobrietyMetrics(sequence(MONDAY, [S, S, S, S, S]));
    expect(metrics.soberDays).toBe(5);
    expect(metrics.sobrietyRate).toBe(100);
  });

  it("3 sobres + 2 avec consommation → suivis 5, sobres 3, consommation 2, 60 %", () => {
    const metrics = calculateSobrietyMetrics(sequence(MONDAY, [S, C, S, C, S]));
    expect(metrics).toMatchObject({ trackedDays: 5, soberDays: 3, consumedDays: 2, sobrietyRate: 60 });
  });

  it("« sober_with_craving » compte comme journée sobre", () => {
    const metrics = calculateSobrietyMetrics(sequence(MONDAY, [W, W, S]));
    expect(metrics).toMatchObject({ soberDays: 3, challengingDays: 2, consumedDays: 0 });
  });

  it("10 check-ins dont 8 sobres : 80 %, les journées sans check-in ne changent pas le dénominateur", () => {
    const withGaps = [...sequence("2026-09-01", [S, W, S, S, C]), ...sequence("2026-09-10", [S, S, C, S, W])];
    expect(calculateSobrietyMetrics(withGaps).sobrietyRate).toBe(80);
  });

  it("le cumul des jours sobres ne revient jamais à zéro après une consommation", () => {
    const before = [...sequence("2026-08-01", Array(27).fill(S))];
    const after = [...before, checkin("2026-08-28", C), ...sequence("2026-08-29", Array(8).fill(S))];
    expect(calculateSobrietyMetrics(before).soberDays).toBe(27);
    expect(calculateSobrietyMetrics(after).soberDays).toBe(35);
  });

  it("une journée avec plusieurs consommations compte une seule fois", () => {
    expect(calculateSobrietyMetrics([checkin(MONDAY, C)]).consumedDays).toBe(1);
  });
});

describe("séries (ADR-008 / ADR-042)", () => {
  it("S S C S S → actuelle 2, meilleure 2", () => {
    expect(calculateStreaks(sequence(MONDAY, [S, S, C, S, S]))).toMatchObject({ current: 2, best: 2 });
  });

  it("S S S C S → actuelle 1, meilleure 3", () => {
    expect(calculateStreaks(sequence(MONDAY, [S, S, S, C, S]))).toMatchObject({ current: 1, best: 3 });
  });

  it("journée manquante : lun sobre, mar absent, mer sobre, jeu sobre → 3 (pas 4)", () => {
    const data = [checkin(MONDAY, S), checkin(addDays(MONDAY, 2), S), checkin(addDays(MONDAY, 3), S)];
    expect(calculateStreaks(data)).toMatchObject({ current: 3, best: 3 });
  });

  it("consommation après une journée manquante : lun S, mar absent, mer C, jeu S → actuelle 1, meilleure 1", () => {
    const data = [checkin(MONDAY, S), checkin(addDays(MONDAY, 2), C), checkin(addDays(MONDAY, 3), S)];
    expect(calculateStreaks(data)).toMatchObject({ current: 1, best: 1 });
  });

  it("dernière journée documentée = consommation → série actuelle 0, meilleure intacte", () => {
    const result = calculateStreaks(sequence(MONDAY, [S, S, S, S, C]));
    expect(result).toEqual({ current: 0, best: 4, lastDocumentedWasConsumption: true });
  });

  it("une nouvelle journée sobre démarre une nouvelle série", () => {
    expect(calculateStreaks(sequence(MONDAY, [S, S, C, S])).current).toBe(1);
  });

  it("indépendant de l'ordre reçu", () => {
    const shuffled = [checkin("2026-09-23", S), checkin("2026-09-21", S), checkin("2026-09-22", C)];
    expect(calculateStreaks(shuffled)).toMatchObject({ current: 1, best: 1 });
  });

  it("aucun check-in → 0 / 0", () => {
    expect(calculateStreaks([])).toEqual({ current: 0, best: 0, lastDocumentedWasConsumption: false });
  });
});

describe("semaine en cours (lundi → dimanche)", () => {
  const thursday = "2026-09-24";

  it("commence le lundi, même si aujourd'hui est dimanche", () => {
    expect(getWeekStart(thursday)).toBe(MONDAY);
    expect(getWeekStart("2026-09-27")).toBe(MONDAY);
    expect(getWeekStart(MONDAY)).toBe(MONDAY);
  });

  it("distingue passé documenté, non documenté, aujourd'hui et futur", () => {
    const week = buildCurrentWeek(thursday, [
      checkin(MONDAY, S),
      checkin("2026-09-22", W),
      // mercredi 23 : non documenté
      checkin(thursday, C),
    ]);
    expect(week.map((day) => day.state)).toEqual([
      "sober",
      "challenging",
      "untracked",
      "consumed",
      "future",
      "future",
      "future",
    ]);
    expect(week.filter((day) => day.isToday).map((day) => day.date)).toEqual([thursday]);
  });

  it("aujourd'hui sans check-in est « non documenté » (pas futur)", () => {
    expect(buildCurrentWeek(thursday, []).find((day) => day.isToday)?.state).toBe("untracked");
  });
});

describe("7 derniers jours (aujourd'hui + 6 jours calendaires)", () => {
  it("compte sobres, consommation et non documentés ; aujourd'hui en attente n'est pas « non documenté »", () => {
    const today = "2026-09-24";
    const summary = calculateRecentDaysSummary(today, [
      checkin("2026-09-18", S),
      checkin("2026-09-19", W),
      checkin("2026-09-20", S),
      checkin("2026-09-22", C),
      checkin("2026-09-23", S),
      checkin("2026-09-17", S), // hors période
    ]);
    expect(summary).toEqual({
      days: 7,
      soberDays: 4,
      challengingDays: 1,
      consumedDays: 1,
      untrackedDays: 1, // 21 septembre
      todayPending: true,
    });
  });
});

describe("fuseau horaire", () => {
  it("UTC 01:30 le lundi 28 → dimanche 27 à Toronto : même semaine que le 21", () => {
    const today = getUserToday("America/Toronto", new Date("2026-09-28T01:30:00Z"));
    expect(today).toBe("2026-09-27");
    const dashboard = buildDashboard(today, [checkin("2026-09-27", S)]);
    expect(dashboard.week[0].date).toBe(MONDAY);
    expect(dashboard.week[6]).toMatchObject({ date: "2026-09-27", isToday: true, state: "sober" });
    expect(dashboard.metrics.soberDays).toBe(1);
  });

  it("ignore une journée postérieure à « aujourd'hui »", () => {
    const dashboard = buildDashboard("2026-09-24", [checkin("2026-09-24", S), checkin("2026-09-25", S)]);
    expect(dashboard.metrics.trackedDays).toBe(1);
  });
});

describe("scores et moyennes", () => {
  it("une journée sans check-in est une absence de donnée, pas 0", () => {
    const points = buildScoreSeries("2026-09-24", [checkin("2026-09-24", S, { stress: 8 })], 7);
    expect(points).toHaveLength(7);
    expect(points[0]).toEqual({ date: "2026-09-18", mood: null, energy: null, stress: null, craving: null });
    expect(points[6].stress).toBe(8);
  });

  it("les moyennes ignorent les valeurs manquantes", () => {
    expect(average([4, null, 6, undefined])).toBe(5);
    expect(average([null, null])).toBeNull();
    const averages = calculateScoreAverages(
      buildScoreSeries("2026-09-24", [checkin("2026-09-22", S, { mood: 7, stress: 3 }), checkin("2026-09-24", S, { mood: 5, stress: 6 })], 7),
    );
    expect(averages).toMatchObject({ mood: 6, stress: 4.5, checkinCount: 2 });
  });

  it("formatage français, une décimale maximum", () => {
    expect(formatDecimal(6.4)).toBe("6,4");
    expect(formatDecimal(6.46)).toBe("6,5");
    expect(formatDecimal(6)).toBe("6");
    expect(formatScore(5.25)).toBe("5,3 / 10");
    expect(formatPercent(87.5)).toBe("87,5 %");
  });
});

describe("tendances descriptives", () => {
  it("moins de 7 check-ins → aucune conclusion", () => {
    const six = sequence(MONDAY, [S, S, S, S, S, S]).map((item, index) => ({
      ...item,
      craving: index % 2 ? 9 : 1,
      triggers: index % 2 ? ["stress"] : [],
    }));
    expect(generateDescriptiveInsights(six)).toEqual([]);
    expect(buildDashboard(addDays(MONDAY, 6), six).checkinsBeforeInsights).toBe(1);
  });

  it("stress / envie : affichée seulement avec assez de données et un écart suffisant", () => {
    const data = sequence("2026-09-01", Array(12).fill(S)).map((item, index) => ({
      ...item,
      triggers: index < 4 ? ["stress"] : [],
      craving: index < 4 ? 7 : 3,
    }));
    const insights = generateDescriptiveInsights(data);
    expect(insights.map((insight) => insight.id)).toContain("stress_trigger");
    expect(insights.find((insight) => insight.id === "stress_trigger")?.text).toBe(
      "Dans tes données, ton envie moyenne a été plus élevée les jours où tu as indiqué le stress comme déclencheur (7 / 10 contre 3 / 10).",
    );

    const tooFewStressDays = data.map((item, index) => ({ ...item, triggers: index < 2 ? ["stress"] : [] }));
    expect(generateDescriptiveInsights(tooFewStressDays).map((insight) => insight.id)).not.toContain("stress_trigger");

    const smallGap = data.map((item, index) => ({ ...item, craving: index < 4 ? 4 : 3 }));
    expect(generateDescriptiveInsights(smallGap).map((insight) => insight.id)).not.toContain("stress_trigger");
  });

  it("activité physique / envie : description d'une association", () => {
    const data = sequence("2026-09-01", Array(10).fill(S)).map((item, index) => ({
      ...item,
      achievements: index % 2 ? ["exercise"] : [],
      craving: index % 2 ? 2 : 6,
    }));
    const text = generateDescriptiveInsights(data).find((insight) => insight.id === "physical_activity")?.text;
    expect(text).toBe(
      "Dans tes données, les journées où tu as indiqué une activité physique sont associées à une envie moyenne plus faible (2 / 10 contre 6 / 10).",
    );
  });

  it("évolution : 7 derniers check-ins vs 7 précédents, seulement avec 14 check-ins", () => {
    const data = sequence("2026-09-01", Array(14).fill(S)).map((item, index) => ({
      ...item,
      stress: index < 7 ? 7 : 5,
    }));
    expect(generateDescriptiveInsights(data)[0].text).toBe(
      "Ton stress moyen est passé de 7 / 10 à 5 / 10 sur tes 7 derniers check-ins, par rapport aux 7 précédents.",
    );
    expect(generateDescriptiveInsights(data.slice(1)).map((insight) => insight.id)).not.toContain("evolution");
  });

  it("jour de la semaine : exige au moins 3 observations pour ce jour", () => {
    // 21 journées à partir d'un lundi : 3 vendredis avec une envie élevée.
    const data = sequence(MONDAY, Array(21).fill(S)).map((item) => ({
      ...item,
      craving: new Date(`${item.date}T00:00:00Z`).getUTCDay() === 5 ? 9 : 3,
    }));
    const weekday = generateDescriptiveInsights(data).find((insight) => insight.id === "weekday");
    expect(weekday?.text).toBe(
      "Dans tes données, le vendredi est le jour de la semaine où ton envie moyenne est la plus élevée (9 / 10, sur 3 vendredis enregistrés).",
    );
    const onlyTwoFridays = data.slice(0, 14);
    expect(generateDescriptiveInsights(onlyTwoFridays).map((insight) => insight.id)).not.toContain("weekday");
  });

  it("au plus 3 observations", () => {
    const data = sequence(MONDAY, Array(21).fill(S)).map((item, index) => ({
      ...item,
      stress: index < 14 ? 8 : 4,
      triggers: index % 3 === 0 ? ["stress"] : [],
      achievements: index % 2 ? ["exercise"] : [],
      craving: (index % 3 === 0 ? 8 : 3) + (new Date(`${item.date}T00:00:00Z`).getUTCDay() === 5 ? 1 : 0),
    }));
    expect(generateDescriptiveInsights(data).length).toBeLessThanOrEqual(INSIGHT_RULES.maxInsights);
  });

  it("aucune formulation causale, médicale ou culpabilisante dans les modèles", () => {
    const texts = [
      insightTemplates.evolution("stress", 6.3, 5.1),
      insightTemplates.evolution("craving", 3, 6),
      insightTemplates.evolution("mood", 5, 7),
      insightTemplates.stressTrigger(7, 3),
      insightTemplates.stressTrigger(3, 7),
      insightTemplates.physicalActivity(2, 6),
      insightTemplates.physicalActivity(6, 2),
      insightTemplates.weekday("vendredi", 8, 4),
    ];
    const forbidden =
      /\b(réduit|réduire|provoque|cause|à cause|parce que|entraîne|déclenche tes|diagnostic|dépendance|risque|rechute|prédi|échec|traitement|médic)/i;
    for (const text of texts) {
      expect(text).not.toMatch(forbidden);
    }
  });
});
