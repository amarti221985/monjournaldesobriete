import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { MAX_PLAN_FAVORITES } from "@/features/plan/constants";
import {
  buildQuickSupport,
  groupCravingStrategies,
  hasQuickSupport,
  remainingFavorites,
  sortContacts,
  sortStrategies,
  toTelHref,
  type PlanContact,
  type PlanStrategy,
} from "@/features/plan/logic";
import {
  createAddSubstanceSchema,
  createUpdateSubstanceSchema,
  letterSchema,
  personalStrategySchema,
  personalTriggerSchema,
  planContactSchema,
  planMotivationsSchema,
  planReasonSchema,
  reminderSchema,
  safePlaceSchema,
} from "@/features/plan/schemas";

const TODAY = "2026-09-24";

function strategy(overrides: Partial<PlanStrategy> = {}): PlanStrategy {
  return {
    id: randomUUID(),
    strategySlug: "walk",
    name: "Marcher",
    customName: null,
    notes: null,
    defaultDurationMinutes: null,
    isFavorite: false,
    ...overrides,
  };
}

function contact(name: string, isPrimary = false): PlanContact {
  return { id: randomUUID(), name, relationship: null, phone: null, email: null, isPrimary };
}

describe("Mon parcours", () => {
  const update = createUpdateSubstanceSchema(TODAY);
  const add = createAddSubstanceSchema(TODAY);

  it("objectif et date modifiables ; date future refusée", () => {
    const base = { id: randomUUID(), goal: "reduction", startedOn: "2026-09-01" };
    expect(update.safeParse(base).success).toBe(true);
    expect(update.safeParse({ ...base, startedOn: "2026-09-25" }).success).toBe(false);
    expect(update.safeParse({ ...base, goal: "arrêter" }).success).toBe(false);
  });

  it("ajout : slug du catalogue (jamais un identifiant), objectif, date", () => {
    expect(add.safeParse({ slug: "nicotine", goal: "reduction", startedOn: TODAY }).success).toBe(true);
    expect(add.safeParse({ slug: "Nicotine!", goal: "reduction", startedOn: TODAY }).success).toBe(false);
  });
});

describe("raison et motivations", () => {
  it("raison : 1 à 2000 caractères", () => {
    expect(planReasonSchema.safeParse({ reason: "Je veux retrouver mon énergie." }).success).toBe(true);
    expect(planReasonSchema.safeParse({ reason: "   " }).success).toBe(false);
    expect(planReasonSchema.safeParse({ reason: "a".repeat(2001) }).success).toBe(false);
  });

  it("au moins une motivation ; précision seulement pour « other »", () => {
    expect(planMotivationsSchema.safeParse({ motivations: [] }).success).toBe(false);
    expect(planMotivationsSchema.parse({ motivations: ["health"], otherLabel: "ignoré" })).toEqual({
      motivations: ["health"],
      otherLabel: undefined,
    });
    expect(planMotivationsSchema.parse({ motivations: ["other"], otherLabel: " Mon projet " }).otherLabel).toBe("Mon projet");
    expect(planMotivationsSchema.safeParse({ motivations: ["pirate"] }).success).toBe(false);
  });
});

describe("déclencheurs personnels", () => {
  it("catalogue (Stress) ou texte personnel (« Fin de soirée seul »)", () => {
    expect(personalTriggerSchema.safeParse({ triggerSlug: "stress" }).success).toBe(true);
    expect(personalTriggerSchema.parse({ triggerSlug: null, customLabel: "Fin de soirée seul" }).customLabel).toBe("Fin de soirée seul");
    expect(personalTriggerSchema.safeParse({ triggerSlug: null, customLabel: " " }).success).toBe(false);
  });

  it("notes « Ce que je remarque » : 1000 caractères maximum", () => {
    expect(personalTriggerSchema.safeParse({ triggerSlug: "work", notes: "a".repeat(1001) }).success).toBe(false);
  });
});

describe("stratégies personnelles", () => {
  it("catalogue ou nom personnel ; durées aucune / 5 / 10 / 15 / 20", () => {
    expect(personalStrategySchema.safeParse({ strategySlug: "walk", defaultDurationMinutes: 20 }).success).toBe(true);
    expect(personalStrategySchema.safeParse({ strategySlug: null, customName: "Aller chez ma sœur", defaultDurationMinutes: null }).success).toBe(true);
    expect(personalStrategySchema.safeParse({ strategySlug: null, defaultDurationMinutes: null }).success).toBe(false);
    expect(personalStrategySchema.safeParse({ strategySlug: "walk", defaultDurationMinutes: 7 }).success).toBe(false);
  });

  it("favoris restants avant la limite de 3", () => {
    const list = [strategy({ isFavorite: true }), strategy({ isFavorite: true }), strategy()];
    expect(remainingFavorites(list, MAX_PLAN_FAVORITES)).toBe(1);
    expect(remainingFavorites([...list, strategy({ isFavorite: true }), strategy({ isFavorite: true })], 3)).toBe(0);
  });

  it("favoris d'abord, ordre d'origine conservé", () => {
    const a = strategy({ name: "A" });
    const b = strategy({ name: "B", isFavorite: true });
    const c = strategy({ name: "C" });
    expect(sortStrategies([a, b, c]).map((item) => item.name)).toEqual(["B", "A", "C"]);
  });
});

describe("soutien, lieux, rappel, lettre", () => {
  it("contact : nom requis, courriel valide, téléphone souple", () => {
    expect(planContactSchema.safeParse({ name: "Marie", phone: "+1 (514) 555-0100" }).success).toBe(true);
    expect(planContactSchema.safeParse({ name: "Marie", email: "pas-un-courriel" }).success).toBe(false);
    expect(planContactSchema.safeParse({ name: " " }).success).toBe(false);
  });

  it("personne principale affichée en premier", () => {
    expect(sortContacts([contact("Sam"), contact("Marie", true)]).map((item) => item.name)).toEqual(["Marie", "Sam"]);
  });

  it("lieu sûr : texte seulement (80 caractères), aucune coordonnée", () => {
    expect(safePlaceSchema.parse({ name: " Parc près de chez moi " })).toEqual({ name: "Parc près de chez moi", description: undefined });
    expect(safePlaceSchema.safeParse({ name: "a".repeat(81) }).success).toBe(false);
    expect(Object.keys(safePlaceSchema.shape)).toEqual(["name", "description"]);
  });

  it("rappel 1000 caractères, lettre 5000 (sauts de ligne conservés)", () => {
    expect(reminderSchema.safeParse({ content: "Je peux traverser ce moment." }).success).toBe(true);
    expect(reminderSchema.safeParse({ content: "a".repeat(1001) }).success).toBe(false);
    expect(letterSchema.parse({ content: "Ligne 1\nLigne 2 " }).content).toBe("Ligne 1\nLigne 2");
    expect(letterSchema.safeParse({ content: "a".repeat(5001) }).success).toBe(false);
  });

  it("lien tel: nettoyé", () => {
    expect(toTelHref("514 555-0100")).toBe("tel:5145550100");
    expect(toTelHref("+1 (514) 555-0100")).toBe("tel:+15145550100");
  });
});

describe("intégration au mode envie", () => {
  const catalogue = [
    { slug: "walk", name: "Marcher", description: "Bouger.", defaultDurationMinutes: 10 },
    { slug: "music", name: "Écouter de la musique", description: "Musique.", defaultDurationMinutes: 10 },
    { slug: "breathe", name: "Respirer lentement", description: "Respirer.", defaultDurationMinutes: 5 },
  ];

  it("« Tes stratégies » (favoris d'abord) puis « Autres stratégies » sans doublon", () => {
    const personal = [
      strategy({ strategySlug: "music", name: "Écouter de la musique" }),
      strategy({ strategySlug: "walk", name: "Marcher", isFavorite: true, defaultDurationMinutes: 20 }),
      strategy({ strategySlug: null, name: "Aller chez ma sœur", customName: "Aller chez ma sœur", notes: "Le samedi." }),
    ];
    const { yours, others } = groupCravingStrategies(personal, catalogue);
    expect(yours.map((item) => item.title)).toEqual(["Marcher", "Écouter de la musique", "Aller chez ma sœur"]);
    expect(yours[0]).toMatchObject({ strategySlug: "walk", customStrategyText: null, defaultDurationMinutes: 20, isFavorite: true });
    expect(yours[2]).toMatchObject({ strategySlug: null, customStrategyText: "Aller chez ma sœur", description: "Le samedi." });
    expect(others.map((item) => item.strategySlug)).toEqual(["breathe"]);
  });

  it("plan vide : seulement le catalogue", () => {
    const { yours, others } = groupCravingStrategies([], catalogue);
    expect(yours).toEqual([]);
    expect(others).toHaveLength(3);
  });

  it("panneau rapide : uniquement ce que l'utilisateur a marqué", () => {
    const empty = buildQuickSupport({ strategies: [strategy()], contacts: [contact("Sam")], places: [], reminder: null });
    expect(hasQuickSupport(empty)).toBe(false);
    const support = buildQuickSupport({
      strategies: [strategy(), strategy({ name: "Marcher", isFavorite: true })],
      contacts: [contact("Sam"), contact("Marie", true)],
      places: [{ id: randomUUID(), name: "Parc", description: null, isFavorite: true }],
      reminder: "Je peux traverser ce moment.",
    });
    expect(support.strategy?.name).toBe("Marcher");
    expect(support.contact?.name).toBe("Marie");
    expect(support.place?.name).toBe("Parc");
    expect(hasQuickSupport(support)).toBe(true);
  });
});
