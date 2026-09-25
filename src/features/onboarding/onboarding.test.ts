import { describe, expect, it } from "vitest";

import {
  buildCompletionPayload,
  resolvePrimarySlug,
  validateStep,
} from "@/features/onboarding/logic";
import {
  createOnboardingCompletionSchema,
  createStartDateSchema,
  motivationsSchema,
  reasonSchema,
  substanceGoalSchema,
  supportContactSchema,
  type OnboardingDraft,
} from "@/features/onboarding/schemas";
import { getLatestAllowedLocalDate } from "@/lib/dates";

// « Aujourd'hui » injecté : aucune date n'est codée en dur dans la logique testée.
const today = getLatestAllowedLocalDate("America/Toronto", new Date("2026-09-24T15:00:00Z"));

const completeDraft: OnboardingDraft = {
  substances: [
    { slug: "cannabis", goal: "abstinence" },
    { slug: "nicotine", goal: "reduction" },
  ],
  primarySlug: "cannabis",
  startedOn: "2026-09-01",
  reason: "Retrouver mon énergie.",
  motivations: ["health", "freedom"],
  supportContact: null,
};

const completionSchema = createOnboardingCompletionSchema(today);

describe("objectifs", () => {
  it.each(["abstinence", "reduction", "observation"])("accepte %s", (goal) => {
    expect(substanceGoalSchema.safeParse(goal).success).toBe(true);
  });

  it.each(["Arrêter complètement", "stop", "", undefined])("refuse %s (libellé ou valeur inconnue)", (goal) => {
    expect(substanceGoalSchema.safeParse(goal).success).toBe(false);
  });
});

describe("date de début", () => {
  const schema = createStartDateSchema(today);

  it("utilise la journée locale injectée", () => {
    expect(today).toBe("2026-09-24");
  });

  it("accepte aujourd'hui et une date passée", () => {
    expect(schema.safeParse("2026-09-24").success).toBe(true);
    expect(schema.safeParse("2025-01-15").success).toBe(true);
  });

  it("refuse une date future (lendemain)", () => {
    const result = schema.safeParse("2026-09-25");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("La date de début ne peut pas être dans le futur.");
  });

  it.each(["", "2026-02-30", "24/09/2026", "1899-12-31"])("refuse %s", (value) => {
    expect(schema.safeParse(value).success).toBe(false);
  });
});

describe("raison", () => {
  it("accepte un texte et retire les espaces en bordure", () => {
    expect(reasonSchema.parse("  Être plus présent.  ")).toBe("Être plus présent.");
  });

  it.each(["", "   "])("refuse une raison vide (%j)", (value) => {
    expect(reasonSchema.safeParse(value).success).toBe(false);
  });

  it("refuse plus de 2000 caractères", () => {
    expect(reasonSchema.safeParse("a".repeat(2001)).success).toBe(false);
  });
});

describe("motivations", () => {
  it("exige au moins une motivation", () => {
    expect(motivationsSchema.safeParse([]).success).toBe(false);
    expect(motivationsSchema.safeParse(["health"]).success).toBe(true);
  });

  it("refuse une valeur inconnue ou en double", () => {
    expect(motivationsSchema.safeParse(["Santé"]).success).toBe(false);
    expect(motivationsSchema.safeParse(["health", "health"]).success).toBe(false);
  });
});

describe("contact de soutien", () => {
  it("n'exige que le nom", () => {
    expect(supportContactSchema.safeParse({ name: "Julie" }).success).toBe(true);
  });

  it("nettoie et normalise les champs facultatifs", () => {
    expect(
      supportContactSchema.parse({
        name: "  Julie  ",
        relationship: " Amie ",
        phone: " +1 (514) 555-0100 ",
        email: " Julie@Example.COM ",
      }),
    ).toEqual({ name: "Julie", relationship: "Amie", phone: "+1 (514) 555-0100", email: "julie@example.com" });
  });

  it("traite les champs vides comme absents", () => {
    expect(supportContactSchema.parse({ name: "Julie", phone: "", email: "  " })).toEqual({ name: "Julie" });
  });

  it.each([
    ["nom vide", { name: " " }],
    ["téléphone avec lettres", { name: "Julie", phone: "appelle-moi" }],
    ["téléphone trop long", { name: "Julie", phone: "1".repeat(40) }],
    ["courriel invalide", { name: "Julie", email: "julie@" }],
  ])("refuse : %s", (_label, input) => {
    expect(supportContactSchema.safeParse(input).success).toBe(false);
  });

  it("accepte des formats de téléphone internationaux variés", () => {
    for (const phone of ["514 555-0100", "+33 1 23 45 67 89", "(418) 555.0199"]) {
      expect(supportContactSchema.safeParse({ name: "Julie", phone }).success).toBe(true);
    }
  });
});

describe("substance principale", () => {
  it("choisit la seule substance sélectionnée", () => {
    expect(resolvePrimarySlug(["cannabis"])).toBe("cannabis");
  });

  it("conserve le choix de l'utilisateur s'il est toujours sélectionné", () => {
    expect(resolvePrimarySlug(["cannabis", "nicotine"], "nicotine")).toBe("nicotine");
  });

  it("revient à la première sélection si le choix a été retiré", () => {
    expect(resolvePrimarySlug(["alcohol", "nicotine"], "cannabis")).toBe("alcohol");
  });

  it("retourne undefined sans sélection", () => {
    expect(resolvePrimarySlug([])).toBeUndefined();
  });

  it("refuse une principale absente de la sélection", () => {
    const result = completionSchema.safeParse({
      ...buildCompletionPayload(completeDraft),
      primarySlug: "alcohol",
    });
    expect(result.success).toBe(false);
  });
});

describe("plusieurs substances", () => {
  it("accepte cannabis → abstinence et nicotine → reduction simultanément, une seule principale", () => {
    const result = completionSchema.safeParse(buildCompletionPayload(completeDraft));
    expect(result.success).toBe(true);
    expect(result.data?.substances).toEqual([
      { slug: "cannabis", goal: "abstinence" },
      { slug: "nicotine", goal: "reduction" },
    ]);
    expect(result.data?.primarySlug).toBe("cannabis");
  });

  it("refuse deux fois la même substance", () => {
    const result = completionSchema.safeParse(
      buildCompletionPayload({
        ...completeDraft,
        substances: [
          { slug: "cannabis", goal: "abstinence" },
          { slug: "cannabis", goal: "reduction" },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("ne conserve une précision que pour « Autre »", () => {
    const payload = buildCompletionPayload({
      ...completeDraft,
      substances: [
        { slug: "cannabis", customName: "ignoré", goal: "abstinence" },
        { slug: "other", customName: "Jeux d'argent", goal: "observation" },
      ],
    });
    expect(payload.substances).toEqual([
      { slug: "cannabis", customName: undefined, goal: "abstinence" },
      { slug: "other", customName: "Jeux d'argent", goal: "observation" },
    ]);
  });
});

describe("données minimales de finalisation", () => {
  it.each([
    ["aucune substance", { substances: [] }],
    ["aucun objectif", { substances: [{ slug: "cannabis" }] }],
    ["aucune date", { startedOn: undefined }],
    ["date future", { startedOn: "2026-09-25" }],
    ["aucune raison", { reason: "  " }],
    ["aucune motivation", { motivations: [] }],
  ] satisfies [string, Partial<OnboardingDraft>][])("refuse : %s", (_label, override) => {
    const result = completionSchema.safeParse(buildCompletionPayload({ ...completeDraft, ...override }));
    expect(result.success).toBe(false);
  });

  it("accepte un onboarding complet sans personne de soutien", () => {
    expect(completionSchema.safeParse(buildCompletionPayload(completeDraft)).success).toBe(true);
  });

  it("ignore un contact entièrement vide et valide un contact renseigné", () => {
    const empty = buildCompletionPayload({ ...completeDraft, supportContact: { name: " ", phone: "" } });
    expect(empty.supportContact).toBeNull();

    const partial = buildCompletionPayload({ ...completeDraft, supportContact: { name: "", phone: "514 555-0100" } });
    expect(completionSchema.safeParse(partial).success).toBe(false);
  });

  it("n'envoie la précision « Autre » que si la motivation est choisie", () => {
    expect(buildCompletionPayload({ ...completeDraft, motivationOther: "Voyager" }).motivationOther).toBeUndefined();
    expect(
      buildCompletionPayload({ ...completeDraft, motivations: ["other"], motivationOther: "Voyager" }).motivationOther,
    ).toBe("Voyager");
  });
});

describe("validateStep", () => {
  it("exige une sélection à l'étape substances", () => {
    expect(validateStep("substances", {}, today)).toHaveProperty("substances");
    expect(validateStep("substances", { substances: [{ slug: "alcohol" }] }, today)).toEqual({});
  });

  it("exige un objectif par substance et une principale si plusieurs", () => {
    const errors = validateStep(
      "goals",
      { substances: [{ slug: "cannabis", goal: "abstinence" }, { slug: "nicotine" }] },
      today,
    );
    expect(errors).toEqual({
      "goal-nicotine": "Choisis un objectif.",
      primarySlug: "Choisis ce que tu souhaites principalement changer.",
    });
  });

  it("refuse une date future à l'étape du point de départ", () => {
    expect(validateStep("start", { startedOn: "2026-09-25" }, today)).toHaveProperty("startedOn");
    expect(validateStep("start", { startedOn: "2026-09-24" }, today)).toEqual({});
  });

  it("permet de passer l'étape soutien", () => {
    expect(validateStep("support", { supportContact: null }, today)).toEqual({});
    expect(validateStep("support", { supportContact: { name: "", email: "x" } }, today)).toEqual({
      "contact.name": "Indique un nom ou un prénom.",
      "contact.email": "Cette adresse courriel ne semble pas valide.",
    });
  });

  it("bloque le résumé si une réponse manque", () => {
    expect(validateStep("summary", { ...completeDraft, reason: "" }, today)).toHaveProperty("form");
    expect(validateStep("summary", completeDraft, today)).toEqual({});
  });
});
