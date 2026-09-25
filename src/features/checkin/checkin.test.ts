import { describe, expect, it } from "vitest";

import {
  buildCheckinPayload,
  createEmptyDraft,
  createEmptyEvent,
  getCheckinSteps,
  getResumeStepIndex,
  parseQuantity,
  statusChangeDropsEvents,
  toggleLabelledSelection,
  toggleNoTrigger,
  validateCheckinStep,
  type CheckinDraft,
} from "@/features/checkin/logic";
import {
  checkinStatusSchema,
  consumptionEventSchema,
  cravingScoreSchema,
  createCheckinPayloadSchema,
  moodScoreSchema,
} from "@/features/checkin/schemas";
import { getUserToday } from "@/lib/dates";

// « Aujourd'hui » injecté (journée locale Toronto), jamais codé en dur dans la logique.
const today = getUserToday("America/Toronto", new Date("2026-09-25T01:30:00Z"));
const CANNABIS = "11111111-1111-4111-8111-111111111111";
const ALCOHOL = "22222222-2222-4222-8222-222222222222";

const finalSchema = createCheckinPayloadSchema({ latestAllowedDate: today, finalize: true });
const draftSchema = createCheckinPayloadSchema({ latestAllowedDate: today, finalize: false });

function soberDraft(overrides: Partial<CheckinDraft> = {}): CheckinDraft {
  return {
    ...createEmptyDraft(),
    status: "sober",
    moodScore: 7,
    energyScore: 6,
    stressScore: 4,
    cravingScore: 2,
    emotions: ["calm", "pride"],
    achievements: [{ slug: "exercise" }],
    victoryText: "Une marche le soir.",
    ...overrides,
  };
}

function consumedDraft(events = [{ ...createEmptyEvent("e1", CANNABIS) }]): CheckinDraft {
  return soberDraft({ status: "consumed", consumptionEvents: events });
}

describe("journée locale du check-in", () => {
  it("UTC 01:30 le 25 → journée du 24 à Toronto", () => {
    expect(today).toBe("2026-09-24");
  });
});

describe("statut", () => {
  it.each(["sober", "sober_with_craving", "consumed"])("accepte %s", (status) => {
    expect(checkinStatusSchema.safeParse(status).success).toBe(true);
  });

  it.each(["Sobre", "relapse", "", undefined])("refuse %s", (status) => {
    expect(checkinStatusSchema.safeParse(status).success).toBe(false);
  });

  it("ne déduit jamais le statut de l'envie : envie 8 + « sober » reste valide", () => {
    const payload = buildCheckinPayload(soberDraft({ cravingScore: 8 }), today);
    const result = finalSchema.safeParse(payload);
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe("sober");
  });
});

describe("scores", () => {
  it("accepte les bornes", () => {
    expect(moodScoreSchema.safeParse(1).success).toBe(true);
    expect(moodScoreSchema.safeParse(10).success).toBe(true);
    expect(cravingScoreSchema.safeParse(0).success).toBe(true);
    expect(cravingScoreSchema.safeParse(10).success).toBe(true);
  });

  it.each([
    ["humeur 0", moodScoreSchema, 0],
    ["humeur 11", moodScoreSchema, 11],
    ["envie -1", cravingScoreSchema, -1],
    ["envie 11", cravingScoreSchema, 11],
    ["décimal", moodScoreSchema, 5.5],
  ] as const)("refuse %s", (_label, schema, value) => {
    expect(schema.safeParse(value).success).toBe(false);
  });

  it("exige les 4 scores pour terminer, pas pour un brouillon", () => {
    const partial = buildCheckinPayload(soberDraft({ stressScore: undefined }), today);
    expect(finalSchema.safeParse(partial).success).toBe(false);
    expect(draftSchema.safeParse(partial).success).toBe(true);
  });
});

describe("date", () => {
  it("refuse un check-in futur", () => {
    const result = finalSchema.safeParse(buildCheckinPayload(soberDraft(), "2026-09-25"));
    expect(result.success).toBe(false);
  });

  it("accepte aujourd'hui et une journée passée", () => {
    expect(finalSchema.safeParse(buildCheckinPayload(soberDraft(), today)).success).toBe(true);
    expect(finalSchema.safeParse(buildCheckinPayload(soberDraft(), "2026-09-20")).success).toBe(true);
  });

  it("minuit : la date du check-in reste celle du début, même si « aujourd'hui » a changé", () => {
    const startedOn = today; // 24 septembre au moment de commencer
    const afterMidnight = getUserToday("America/Toronto", new Date("2026-09-25T04:10:00Z"));
    expect(afterMidnight).toBe("2026-09-25");
    const schemaAfterMidnight = createCheckinPayloadSchema({ latestAllowedDate: afterMidnight, finalize: true });
    const result = schemaAfterMidnight.safeParse(buildCheckinPayload(soberDraft(), startedOn));
    expect(result.success).toBe(true);
    expect(result.data?.checkinDate).toBe("2026-09-24");
  });
});

describe("longueur des textes", () => {
  it.each([
    ["victoryText", 1000],
    ["proudOfText", 2000],
    ["lessonText", 2000],
    ["tomorrowIntentionText", 1000],
    ["notes", 5000],
  ] as const)("%s : %d caractères maximum", (field, max) => {
    expect(finalSchema.safeParse(buildCheckinPayload(soberDraft({ [field]: "a".repeat(max) }), today)).success).toBe(true);
    expect(finalSchema.safeParse(buildCheckinPayload(soberDraft({ [field]: "a".repeat(max + 1) }), today)).success).toBe(false);
  });

  it("les textes vides deviennent absents", () => {
    const result = finalSchema.parse(buildCheckinPayload(soberDraft({ lessonText: "   " }), today));
    expect(result.lessonText).toBeUndefined();
  });
});

describe("événements de consommation", () => {
  it("valide un événement minimal (substance seulement : aucune précision forcée)", () => {
    expect(consumptionEventSchema.safeParse({ userSubstanceId: CANNABIS }).success).toBe(true);
  });

  it("valide un événement complet", () => {
    const result = consumptionEventSchema.safeParse({
      userSubstanceId: CANNABIS,
      quantity: 1.5,
      unit: "joint",
      occurredAt: "21:30",
      cravingBefore: 7,
      contextText: "Soirée seul.",
    });
    expect(result.success).toBe(true);
  });

  it.each([
    ["substance invalide", { userSubstanceId: "cannabis" }],
    ["quantité négative", { userSubstanceId: CANNABIS, quantity: -1 }],
    ["heure invalide", { userSubstanceId: CANNABIS, occurredAt: "25:00" }],
    ["envie hors limite", { userSubstanceId: CANNABIS, cravingBefore: 11 }],
  ])("refuse : %s", (_label, input) => {
    expect(consumptionEventSchema.safeParse(input).success).toBe(false);
  });

  it("« consumed » sans événement est refusé à la finalisation", () => {
    const result = finalSchema.safeParse(buildCheckinPayload(consumedDraft([]), today));
    expect(result.success).toBe(false);
  });

  it("« sober » avec événement est refusé", () => {
    const payload = { ...buildCheckinPayload(soberDraft(), today), consumptionEvents: [{ userSubstanceId: CANNABIS }] };
    expect(finalSchema.safeParse(payload).success).toBe(false);
    expect(draftSchema.safeParse(payload).success).toBe(false);
  });

  it("n'envoie jamais d'événement pour une journée sobre", () => {
    const draft = soberDraft({ consumptionEvents: [createEmptyEvent("e1", CANNABIS)] });
    expect(buildCheckinPayload(draft, today).consumptionEvents).toEqual([]);
  });

  it("plusieurs substances suivies, une seule consommée : valide", () => {
    const result = finalSchema.safeParse(buildCheckinPayload(consumedDraft(), today));
    expect(result.success).toBe(true);
    expect(result.data?.consumptionEvents).toHaveLength(1);
  });

  it("plusieurs événements : même substance deux fois, ou deux substances", () => {
    const twice = consumedDraft([
      { ...createEmptyEvent("e1", CANNABIS), occurredAt: "18:00" },
      { ...createEmptyEvent("e2", CANNABIS), occurredAt: "22:00" },
    ]);
    const both = consumedDraft([createEmptyEvent("e1", CANNABIS), createEmptyEvent("e2", ALCOHOL)]);
    expect(finalSchema.safeParse(buildCheckinPayload(twice, today)).success).toBe(true);
    expect(finalSchema.safeParse(buildCheckinPayload(both, today)).success).toBe(true);
  });
});

describe("quantité saisie", () => {
  it.each([
    ["", null],
    ["2", 2],
    ["1,5", 1.5],
    ["1.25", 1.25],
  ])("« %s » → %s", (input, expected) => {
    expect(parseQuantity(input)).toBe(expected);
  });

  it.each(["abc", "0", "-2", "1,555", "20000"])("« %s » est invalide", (input) => {
    expect(parseQuantity(input)).toBeUndefined();
  });
});

describe("modification du statut", () => {
  it("sober → consumed : exige ensuite au moins un événement", () => {
    const draft = soberDraft({ status: "consumed" });
    expect(getCheckinSteps(draft.status)).toContain("consumption");
    expect(validateCheckinStep("consumption", draft)).toHaveProperty("consumptionEvents");
  });

  it("consumed → sober : confirmation requise si des consommations sont notées, puis aucune n'est envoyée", () => {
    const draft = consumedDraft();
    expect(statusChangeDropsEvents(draft, "sober")).toBe(true);
    expect(statusChangeDropsEvents(soberDraft(), "consumed")).toBe(false);
    const payload = buildCheckinPayload({ ...draft, status: "sober" }, today);
    expect(payload.consumptionEvents).toEqual([]);
    expect(finalSchema.safeParse(payload).success).toBe(true);
  });
});

describe("étapes du wizard", () => {
  it("l'étape consommation n'apparaît que pour « consumed »", () => {
    expect(getCheckinSteps("sober")).not.toContain("consumption");
    expect(getCheckinSteps("sober_with_craving")).not.toContain("consumption");
    expect(getCheckinSteps("consumed")).toEqual([
      "status", "scores", "emotions", "triggers", "consumption", "achievements", "reflection", "summary",
    ]);
    expect(getCheckinSteps("sober")).toHaveLength(7);
  });

  it("exige un statut et les 4 scores", () => {
    expect(validateCheckinStep("status", createEmptyDraft())).toHaveProperty("status");
    expect(Object.keys(validateCheckinStep("scores", { ...createEmptyDraft(), moodScore: 5 }))).toEqual([
      "energyScore", "stressScore", "cravingScore",
    ]);
  });

  it("valide une quantité saisie", () => {
    const errors = validateCheckinStep("consumption", consumedDraft([{ ...createEmptyEvent("e1", CANNABIS), quantity: "beaucoup" }]));
    expect(errors).toHaveProperty("event-e1-quantity");
  });

  it("reprend un brouillon après la dernière étape renseignée", () => {
    expect(getResumeStepIndex({ ...createEmptyDraft(), status: "sober" })).toBe(1);
    const afterScores = soberDraft({ emotions: [], achievements: [], victoryText: "" });
    expect(getCheckinSteps("sober")[getResumeStepIndex(afterScores)]).toBe("emotions");
    const consumedWithoutEvent = soberDraft({ status: "consumed", emotions: [], achievements: [], victoryText: "" });
    expect(getCheckinSteps("consumed")[getResumeStepIndex(consumedWithoutEvent)]).toBe("emotions");
  });
});

describe("sélections", () => {
  it("« Aucun déclencheur particulier » désélectionne les autres et n'est pas stocké", () => {
    const draft = { ...soberDraft({ triggers: [{ slug: "stress" }] }), ...toggleNoTrigger(true) };
    expect(draft.triggers).toEqual([]);
    expect(buildCheckinPayload(draft, today).triggers).toEqual([]);
  });

  it("la précision n'est conservée que pour « other »", () => {
    const payload = buildCheckinPayload(
      soberDraft({ triggers: [{ slug: "stress", customLabel: "ignoré" }, { slug: "other", customLabel: " Mon patron " }] }),
      today,
    );
    expect(finalSchema.parse(payload).triggers).toEqual([
      { slug: "stress", customLabel: undefined },
      { slug: "other", customLabel: "Mon patron" },
    ]);
  });

  it("ajoute et retire une sélection sans doublon", () => {
    const selected = toggleLabelledSelection([{ slug: "goals" }], "goals", true);
    expect(selected).toEqual([{ slug: "goals" }]);
    expect(toggleLabelledSelection(selected, "goals", false)).toEqual([]);
  });

  it("refuse une émotion en double", () => {
    const payload = buildCheckinPayload(soberDraft({ emotions: ["calm", "calm"] }), today);
    expect(finalSchema.safeParse(payload).success).toBe(false);
  });
});

describe("payload valide complet", () => {
  it("produit un payload accepté par la validation serveur", () => {
    const result = finalSchema.safeParse(buildCheckinPayload(soberDraft({ proudOfText: "Avoir tenu bon." }), today));
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      checkinDate: "2026-09-24",
      status: "sober",
      moodScore: 7,
      emotions: ["calm", "pride"],
      achievements: [{ slug: "exercise" }],
      proudOfText: "Avoir tenu bon.",
      consumptionEvents: [],
    });
  });
});
