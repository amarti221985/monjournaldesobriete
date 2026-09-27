import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { CUSTOM_STRATEGY } from "@/features/craving/constants";
import {
  calculateCravingReduction,
  calculateStrategyEffectiveness,
  describeCravingResult,
  describeStrategyEffectiveness,
  formatApproxDuration,
  formatMeasuredDuration,
  formatCountdown,
  formatCravingDelta,
  getCravingChange,
  getCravingPhase,
  getTimerState,
} from "@/features/craving/logic";
import {
  completeCravingSchema,
  cravingScoreSchema,
  startCravingEventSchema,
  startInterventionSchema,
} from "@/features/craving/schemas";
import { getUserToday } from "@/lib/dates";

const CANNABIS = randomUUID();
const NICOTINE = randomUUID();

function startPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    initialCravingScore: 8,
    substanceIds: [CANNABIS],
    emotions: [],
    triggers: [],
    triggerUnknown: false,
    contextText: "",
    ...overrides,
  };
}

const FORBIDDEN = /excellent|bravo|échec|échou|fonctionne|meilleure|risque|danger|urgence|%/i;

describe("validation des scores", () => {
  it.each([
    [-1, false],
    [0, true],
    [10, true],
    [11, false],
    [4.5, false],
  ])("envie %s → valide : %s", (value, valid) => {
    expect(cravingScoreSchema.safeParse(value).success).toBe(valid);
    expect(startCravingEventSchema.safeParse(startPayload({ initialCravingScore: value })).success).toBe(valid);
    expect(completeCravingSchema.safeParse({ finalCravingScore: value }).success).toBe(valid);
  });

  it("score final obligatoire", () => {
    expect(completeCravingSchema.safeParse({}).success).toBe(false);
  });
});

describe("validation du moment", () => {
  it("cannabis + nicotine → valide", () => {
    const result = startCravingEventSchema.safeParse(startPayload({ substanceIds: [CANNABIS, NICOTINE] }));
    expect(result.success).toBe(true);
  });

  it("au moins une substance, sans doublon", () => {
    expect(startCravingEventSchema.safeParse(startPayload({ substanceIds: [] })).success).toBe(false);
    expect(startCravingEventSchema.safeParse(startPayload({ substanceIds: [CANNABIS, CANNABIS] })).success).toBe(false);
  });

  it("« Je ne sais pas » est une réponse valide, mais pas avec un déclencheur", () => {
    expect(startCravingEventSchema.safeParse(startPayload({ triggerUnknown: true })).success).toBe(true);
    expect(
      startCravingEventSchema.safeParse(startPayload({ triggerUnknown: true, triggers: [{ slug: "stress" }] })).success,
    ).toBe(false);
  });

  it("émotions et déclencheurs facultatifs ; précision seulement pour « Autre »", () => {
    const parsed = startCravingEventSchema.parse(
      startPayload({ triggers: [{ slug: "stress", customLabel: "x" }, { slug: "other", customLabel: " Précision " }] }),
    );
    expect(parsed.triggers).toEqual([
      { slug: "stress", customLabel: undefined },
      { slug: "other", customLabel: "Précision" },
    ]);
  });

  it("contexte limité à 2000 caractères, vide → absent", () => {
    expect(startCravingEventSchema.parse(startPayload({ contextText: "   " })).contextText).toBeUndefined();
    expect(startCravingEventSchema.safeParse(startPayload({ contextText: "a".repeat(2001) })).success).toBe(false);
  });
});

describe("validation de la stratégie", () => {
  it("stratégie du catalogue, 10 minutes", () => {
    expect(startInterventionSchema.safeParse({ strategySlug: "walk", plannedDurationMinutes: 10 }).success).toBe(true);
  });

  it("stratégie personnelle : texte requis (500 max)", () => {
    expect(startInterventionSchema.safeParse({ strategySlug: null, plannedDurationMinutes: 5 }).success).toBe(false);
    expect(
      startInterventionSchema.safeParse({ strategySlug: null, customStrategyText: "a".repeat(501), plannedDurationMinutes: 5 }).success,
    ).toBe(false);
    const parsed = startInterventionSchema.parse({ strategySlug: null, customStrategyText: " Dessiner ", plannedDurationMinutes: null });
    expect(parsed).toMatchObject({ strategySlug: null, customStrategyText: "Dessiner", plannedDurationMinutes: null });
  });

  it("stratégie du catalogue : le texte personnel est ignoré", () => {
    const parsed = startInterventionSchema.parse({ strategySlug: "walk", customStrategyText: "x", plannedDurationMinutes: 15 });
    expect(parsed.customStrategyText).toBeUndefined();
  });

  it("durées proposées seulement : 5, 10, 15, 20 ou sans minuteur", () => {
    for (const duration of [5, 10, 15, 20, null]) {
      expect(startInterventionSchema.safeParse({ strategySlug: "walk", plannedDurationMinutes: duration }).success).toBe(true);
    }
    for (const duration of [0, 7, 121]) {
      expect(startInterventionSchema.safeParse({ strategySlug: "walk", plannedDurationMinutes: duration }).success).toBe(false);
    }
  });
});

describe("minuteur fondé sur des horodatages", () => {
  const start = "2026-09-24T14:00:00.000Z";
  const at = (seconds: number) => Date.parse(start) + seconds * 1000;
  const snapshot = { startedAt: start, pausedAt: null, pausedSeconds: 0, plannedMinutes: 10 };

  it("démarrage : 10:00 restantes", () => {
    const state = getTimerState(snapshot, at(0));
    expect(state).toEqual({ elapsedSeconds: 0, remainingSeconds: 600, paused: false, expired: false });
    expect(formatCountdown(state.remainingSeconds ?? 0)).toBe("10:00");
  });

  it("rafraîchissement ou changement d'onglet : recalculé depuis le début enregistré", () => {
    // 18 secondes plus tard, sans aucun décompte local : 09:42.
    expect(formatCountdown(getTimerState(snapshot, at(18)).remainingSeconds ?? 0)).toBe("09:42");
    // Mise en veille de 4 minutes : le temps a continué de passer.
    expect(getTimerState(snapshot, at(258)).remainingSeconds).toBe(342);
  });

  it("expiration : 0 restante, jamais négatif", () => {
    expect(getTimerState(snapshot, at(600))).toMatchObject({ remainingSeconds: 0, expired: true, elapsedSeconds: 600 });
    expect(getTimerState(snapshot, at(5000))).toMatchObject({ remainingSeconds: 0, expired: true, elapsedSeconds: 600 });
  });

  it("pause : le temps ne s'écoule plus ; reprise : la pause est déduite", () => {
    const paused = { ...snapshot, pausedAt: new Date(at(120)).toISOString() };
    expect(getTimerState(paused, at(300))).toMatchObject({ elapsedSeconds: 120, remainingSeconds: 480, paused: true });
    const resumed = { ...snapshot, pausedSeconds: 180 };
    expect(getTimerState(resumed, at(400))).toMatchObject({ elapsedSeconds: 220, remainingSeconds: 380, paused: false });
  });

  it("sans minuteur : pas de temps restant, jamais expiré", () => {
    expect(getTimerState({ ...snapshot, plannedMinutes: null }, at(900))).toEqual({
      elapsedSeconds: 900,
      remainingSeconds: null,
      paused: false,
      expired: false,
    });
  });

  it("durée approximative", () => {
    expect(formatApproxDuration(30)).toBe("moins d'une minute");
    expect(formatApproxDuration(600)).toBe("10 min");
    expect(formatApproxDuration(3900)).toBe("1 h 05");
    expect(formatMeasuredDuration(30)).toBe("moins d'une minute");
    expect(formatMeasuredDuration(600)).toBe("environ 10 min");
  });
});

describe("étape courante (reprise)", () => {
  it.each([
    [{ status: "in_progress", intervention: null }, "strategy"],
    [{ status: "in_progress", intervention: { completedAt: null } }, "active"],
    [{ status: "in_progress", intervention: { completedAt: "2026-09-24T14:10:00Z" } }, "reevaluate"],
    [{ status: "completed", intervention: null }, "done"],
    [{ status: "abandoned", intervention: { completedAt: null } }, "closed"],
  ] as const)("%o → %s", (input, phase) => {
    expect(getCravingPhase(input)).toBe(phase);
  });
});

describe("journée locale", () => {
  it("commencé à 23:58, terminé à 00:08 : la journée de début est conservée", () => {
    const start = getUserToday("America/Toronto", new Date("2026-09-25T03:58:00Z"));
    const end = getUserToday("America/Toronto", new Date("2026-09-25T04:08:00Z"));
    expect(start).toBe("2026-09-24");
    expect(end).toBe("2026-09-25");
    // local_date est fixée au démarrage par la RPC et n'est plus modifiable (voir craving_rls.sql).
  });
});

describe("variation d'envie", () => {
  it("8 → 5 : réduction 3, « −3 points », phrase descriptive", () => {
    expect(calculateCravingReduction(8, 5)).toBe(3);
    expect(getCravingChange(8, 5)).toBe("decrease");
    expect(formatCravingDelta(8, 5)).toBe("−3 points");
    expect(describeCravingResult(8, 5)).toBe("Ton envie est passée de 8/10 à 5/10 pendant cette intervention.");
  });

  it("8 → 8 : réduction 0, formulation neutre", () => {
    expect(calculateCravingReduction(8, 8)).toBe(0);
    expect(formatCravingDelta(8, 8)).toBe("0 point");
    expect(describeCravingResult(8, 8)).toBe("Ton envie est restée à 8/10. Merci d'avoir pris le temps de l'observer.");
  });

  it("5 → 7 : réduction −2, jamais présentée comme un échec", () => {
    expect(calculateCravingReduction(5, 7)).toBe(-2);
    expect(getCravingChange(5, 7)).toBe("increase");
    expect(formatCravingDelta(5, 7)).toBe("+2 points");
    expect(describeCravingResult(5, 7)).not.toMatch(FORBIDDEN);
  });
});

describe("analyse des stratégies", () => {
  const walk = (initial: number, final: number) => ({ initial, final, strategyKey: "walk" });

  it("Marcher 8→5, 7→5, 6→4 : réductions 3, 2, 2 → moyenne 2,33, affichée « 2,3 points »", () => {
    const [result] = calculateStrategyEffectiveness([walk(8, 5), walk(7, 5), walk(6, 4)]);
    expect(result.count).toBe(3);
    expect(result.averageReduction).toBeCloseTo(2.333, 3);
    expect(describeStrategyEffectiveness(result, "Marcher")).toBe(
      "Lors de tes 3 interventions avec « Marcher », ton envie a diminué en moyenne de 2,3 points.",
    );
  });

  it("Marcher utilisé 2 fois : aucune moyenne ni comparaison", () => {
    expect(calculateStrategyEffectiveness([walk(8, 5), walk(7, 5)])).toEqual([]);
  });

  it("hausse moyenne décrite sans jugement", () => {
    const [result] = calculateStrategyEffectiveness([walk(5, 7), walk(5, 7), walk(4, 5)]);
    expect(result.averageReduction).toBeCloseTo(-1.667, 3);
    const text = describeStrategyEffectiveness(result, "Marcher");
    expect(text).toContain("a augmenté en moyenne de 1,7 point");
    expect(text).not.toMatch(FORBIDDEN);
  });

  it("tri par réduction moyenne ; stratégies personnelles regroupées", () => {
    const results = calculateStrategyEffectiveness([
      walk(8, 7),
      walk(8, 7),
      walk(8, 7),
      ...[1, 2, 3].map(() => ({ initial: 9, final: 4, strategyKey: CUSTOM_STRATEGY })),
    ]);
    expect(results.map((item) => item.strategyKey)).toEqual([CUSTOM_STRATEGY, "walk"]);
    expect(describeStrategyEffectiveness(results[0], "")).toContain("une stratégie personnelle");
  });
});
