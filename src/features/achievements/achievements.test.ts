import { describe, expect, it } from "vitest";

import {
  buildAchievementNotification,
  buildAchievementViews,
  evaluateAchievements,
  evaluateCheckinAchievements,
  evaluateCravingAchievements,
  evaluateReflectionAchievements,
  evaluateSobrietyAchievements,
  evaluateUnderstandingAchievements,
  formatEarnedDate,
  nextMilestoneFor,
  progressLabel,
  selectNextSteps,
  type AchievementDefinition,
} from "@/features/achievements/logic";
import type { AchievementCategory } from "@/features/achievements/constants";

let order = 0;
function series(category: AchievementCategory, metric: string, thresholds: number[], isQuantitative = true): AchievementDefinition[] {
  return thresholds.map((threshold) => ({
    slug: `${metric}-${threshold}`,
    category,
    metric,
    threshold,
    isQuantitative,
    name: `${metric} ${threshold}`,
    description: "",
    iconKey: null,
    sortOrder: ++order,
  }));
}

// Même catalogue que la migration (slugs simplifiés).
const CATALOGUE = [
  ...series("sobriety", "sober_days", [1, 3, 7, 14, 30, 60, 90, 180, 365]),
  ...series("sobriety", "best_streak", [7, 14, 30, 60, 90]),
  ...series("consistency", "checkins", [1, 3, 7, 14, 30, 60, 100, 250, 365]),
  ...series("reflection", "reflection_days", [1, 5, 10, 25, 50]),
  ...series("reflection", "victory_days", [1, 10, 25]),
  ...series("understanding", "trigger_days", [1, 5, 10]),
  ...series("understanding", "emotion_days", [5, 20]),
  ...series("action", "craving_interventions", [1, 3, 10, 25]),
  ...series("action", "strategies_tried", [3, 5]),
  ...series("plan", "plan_reason", [1], false),
  ...series("plan", "plan_letter", [1], false),
  ...series("plan", "plan_elements", [5]),
];

const thresholdsOf = (definitions: AchievementDefinition[], metric: string) =>
  definitions.filter((definition) => definition.metric === metric).map((definition) => definition.threshold);

describe("jalons cumulatifs et séries", () => {
  it("65 journées sobres → 1, 3, 7, 14, 30, 60 ; pas 90", () => {
    expect(thresholdsOf(evaluateSobrietyAchievements(CATALOGUE, { sober_days: 65 }), "sober_days")).toEqual([1, 3, 7, 14, 30, 60]);
  });

  it("meilleure série 31 → 7, 14, 30 (32 → pas 60)", () => {
    expect(thresholdsOf(evaluateSobrietyAchievements(CATALOGUE, { best_streak: 31 }), "best_streak")).toEqual([7, 14, 30]);
    expect(thresholdsOf(evaluateSobrietyAchievements(CATALOGUE, { best_streak: 32 }), "best_streak")).not.toContain(60);
  });

  it("103 check-ins → tous les seuils jusqu'à 100 ; 30 check-ins dont 5 consommations → 30", () => {
    expect(thresholdsOf(evaluateCheckinAchievements(CATALOGUE, { checkins: 103 }), "checkins")).toEqual([1, 3, 7, 14, 30, 60, 100]);
    expect(thresholdsOf(evaluateCheckinAchievements(CATALOGUE, { checkins: 30, sober_days: 25 }), "checkins")).toContain(30);
  });

  it("10 réflexions → reflections-10 ; déclencheurs comptés en journées", () => {
    expect(thresholdsOf(evaluateReflectionAchievements(CATALOGUE, { reflection_days: 10 }), "reflection_days")).toEqual([1, 5, 10]);
    // Une journée avec 4 déclencheurs = 1 journée (la base compte des journées).
    expect(thresholdsOf(evaluateUnderstandingAchievements(CATALOGUE, { trigger_days: 1 }), "trigger_days")).toEqual([1]);
  });

  it("interventions terminées (quel que soit le résultat) et stratégies distinctes", () => {
    expect(thresholdsOf(evaluateCravingAchievements(CATALOGUE, { craving_interventions: 3 }), "craving_interventions")).toEqual([1, 3]);
    // Marcher ×10 = 1 stratégie distincte.
    expect(evaluateCravingAchievements(CATALOGUE, { strategies_tried: 1 }).filter((d) => d.metric === "strategies_tried")).toEqual([]);
  });

  it("aucune métrique → aucun accomplissement", () => {
    expect(evaluateAchievements(CATALOGUE, {})).toEqual([]);
  });
});

describe("persistance : l'état actuel ne retire jamais rien", () => {
  it("30 journées sobres obtenues puis 29 aujourd'hui (journée modifiée) → toujours obtenu", () => {
    const earned = [{ slug: "sober_days-30", earnedAt: "2026-09-01T12:00:00Z", dateSource: "exact" as const }];
    const view = buildAchievementViews(CATALOGUE, { sober_days: 29 }, earned).find((item) => item.definition.slug === "sober_days-30");
    expect(view).toMatchObject({ status: "earned", current: 30, earnedAt: "2026-09-01T12:00:00Z" });
  });

  it("lettre supprimée après obtention → reste obtenu", () => {
    const earned = [{ slug: "plan_letter-1", earnedAt: "2026-09-01T12:00:00Z", dateSource: "attribution" as const }];
    const view = buildAchievementViews(CATALOGUE, { plan_letter: 0 }, earned).find((item) => item.definition.slug === "plan_letter-1");
    expect(view?.status).toBe("earned");
  });

  it("jamais « 72 / 60 non obtenu » : un critère dépassé non enregistré est « atteint », valeur plafonnée", () => {
    const view = buildAchievementViews(CATALOGUE, { sober_days: 72 }, []).find((item) => item.definition.slug === "sober_days-60");
    expect(view).toMatchObject({ status: "reached", current: 60 });
  });
});

describe("progression et prochaines étapes", () => {
  const views = buildAchievementViews(
    CATALOGUE,
    { sober_days: 42, checkins: 28, reflection_days: 4, trigger_days: 2, craving_interventions: 1, plan_elements: 2 },
    [],
  );

  it("texte clair « 42 journées sobres enregistrées sur 60 »", () => {
    const view = views.find((item) => item.definition.slug === "sober_days-60");
    expect(view && progressLabel(view)).toBe("42 journées sobres enregistrées sur 60");
  });

  it("au plus 3, un par catégorie, les plus proches de leur seuil", () => {
    const steps = selectNextSteps(views);
    expect(steps).toHaveLength(3);
    expect(new Set(steps.map((step) => step.definition.category)).size).toBe(3);
    expect(steps[0].definition.slug).toBe("checkins-30"); // 28 / 30
    expect(steps.every((step) => step.definition.isQuantitative)).toBe(true);
  });

  it("prochain jalon de participation : 30 check-ins", () => {
    expect(nextMilestoneFor(views, "checkins")?.definition.threshold).toBe(30);
  });
});

describe("dates et notifications", () => {
  it("fuseau : 02:30 UTC le 25 septembre = 24 septembre à Toronto", () => {
    expect(formatEarnedDate("2026-09-25T02:30:00Z", "America/Toronto")).toBe("24 septembre 2026");
    expect(formatEarnedDate("2026-09-25T02:30:00Z", "Europe/Paris")).toBe("25 septembre 2026");
  });

  const item = (slug: string) => ({ slug, name: slug, description: "" });

  it("un nouveau jalon → notification simple ; plusieurs → regroupés (3 cartes max)", () => {
    expect(buildAchievementNotification([item("a")], false)).toMatchObject({ kind: "single" });
    const many = buildAchievementNotification([item("a"), item("b"), item("c"), item("d")], false);
    expect(many).toMatchObject({ kind: "multiple", count: 4 });
    expect(many?.kind === "multiple" && many.achievements).toHaveLength(3);
  });

  it("rattrapage de l'historique → une seule synthèse", () => {
    expect(buildAchievementNotification([item("a"), item("b")], true)).toEqual({ kind: "history", count: 2 });
    expect(buildAchievementNotification([], true)).toBeNull();
  });
});
