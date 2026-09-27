import { describe, expect, it, vi } from "vitest";

import type { ProgressCheckin } from "@/features/progress/types";
import { availableEvidenceKeys, buildWeeklyInsightDataset, type WeeklyInsightDataset, type WeeklyInsightSource } from "@/lib/ai/dataset";
import { validateWeeklyReflection } from "@/lib/ai/guardrails";
import { AI_LIMITS, truncateForAi, type AiPreferences } from "@/lib/ai/privacy";
import { buildWeeklyReflectionUserMessage, WEEKLY_REFLECTION_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import type { AiProvider, ProviderOutcome } from "@/lib/ai/provider";
import type { WeeklyReflection } from "@/lib/ai/schemas";
import { checkWeeklyInsightPreconditions, generateWeeklyInsight, getWeeklyPeriod, isRefundableFailure } from "@/lib/ai/weekly";

/*
 * Bilans intelligents (Sprint 12) : minimisation du jeu de données, garde-fous, flux avec
 * un fournisseur SIMULÉ (aucun appel réseau, aucune donnée réelle).
 */

const ENABLED: AiPreferences = {
  aiEnabled: true,
  includeReflections: false,
  includeConsumptionContext: false,
  includeCravingContext: false,
  consentedAt: "2026-09-20T12:00:00Z",
  consentVersion: "1",
};

const SECRET_MARKERS = {
  email: "personne.fictive@example.invalid",
  phone: "514-555-0199",
  uuid: "3f2b8c1e-9d4a-4e6b-8f7c-1a2b3c4d5e6f",
  letter: "LETTRE-FICTIVE-JAMAIS-ENVOYEE",
  contact: "CONTACT-FICTIF-JAMAIS-ENVOYE",
  note: "NOTE-LIBRE-JAMAIS-ENVOYEE",
};

function checkin(date: string, overrides: Partial<ProgressCheckin> = {}): ProgressCheckin {
  return {
    date,
    status: "sober",
    mood: 6,
    energy: 5,
    stress: 4,
    craving: 3,
    triggers: ["stress"],
    achievements: ["exercise"],
    emotions: ["calm"],
    consumptionEvents: [],
    ...overrides,
  };
}

function source(overrides: Partial<WeeklyInsightSource> = {}): WeeklyInsightSource {
  return {
    range: { start: "2026-09-20", end: "2026-09-26" },
    checkins: [
      checkin("2026-09-21"),
      checkin("2026-09-22", { status: "sober_with_craving", craving: 7 }),
      checkin("2026-09-24", { status: "consumed", consumptionEvents: [{ substanceId: SECRET_MARKERS.uuid }] }),
      checkin("2026-09-25", { mood: 8 }),
    ],
    labels: { triggers: { stress: "Stress" }, emotions: { calm: "Calme" }, achievements: { exercise: "Activité physique" } },
    reflections: [
      { date: "2026-09-21", status: "sober", victory: "Victoire fictive de la journée.", proudOf: null, lesson: "Leçon fictive.", tomorrowIntention: null },
    ],
    consumptionTexts: [{ date: "2026-09-24", context: "Contexte fictif de consommation.", reflection: null, nextTime: "Stratégie fictive." }],
    cravings: [
      { date: "2026-09-22", initial: 8, final: 4, strategyName: "Marcher", context: "Contexte fictif d'envie.", helped: "Aide fictive.", outcome: null },
      { date: "2026-09-23", initial: 6, final: 6, strategyName: null, context: null, helped: null, outcome: null },
    ],
    achievementsUnlocked: ["Premier check-in"],
    ...overrides,
  };
}

const validReflection = (): WeeklyReflection => ({
  summary: "Tu as enregistré quatre journées cette semaine, dont trois sobres, et tu as mené deux interventions jusqu'au bout.",
  progress: [{ text: "Tu as continué tes check-ins après une journée plus difficile.", evidence_keys: ["tracked_days"] }],
  recurring_themes: [{ text: "Le stress apparaît dans plusieurs de tes journées.", evidence_keys: ["frequent_triggers"] }],
  difficult_moments: [],
  strengths: [{ text: "Marcher fait partie des stratégies que tu as essayées.", evidence_keys: ["strategies_used"] }],
  reflection_questions: ["Qu'est-ce qui t'a aidé mardi ?", "Quelle petite chose aimerais-tu garder la semaine prochaine ?"],
});

function fakeProvider(outcomes: ProviderOutcome[]): AiProvider & { calls: WeeklyInsightDataset[] } {
  const calls: WeeklyInsightDataset[] = [];
  let index = 0;
  return {
    name: "test",
    model: "modele-fictif",
    calls,
    generateWeeklyReflection: vi.fn(async (dataset: WeeklyInsightDataset) => {
      calls.push(dataset);
      const outcome = outcomes[Math.min(index, outcomes.length - 1)];
      index += 1;
      return outcome;
    }),
  };
}

describe("buildWeeklyInsightDataset — minimisation", () => {
  it("calcule les métriques par le code", () => {
    const dataset = buildWeeklyInsightDataset(source(), ENABLED);
    expect(dataset.summary).toMatchObject({ tracked_days: 4, sober_days: 3, sober_with_craving_days: 1, consumption_days: 1 });
    expect(dataset.summary.average_mood).toBe(6.5);
    expect(dataset.craving_interventions).toMatchObject({ completed: 2, decreased: 1, unchanged: 1, increased: 0 });
    expect(dataset.strategies_used).toEqual([
      { name: "Marcher", times: 1 },
      { name: "Stratégie personnelle", times: 1 },
    ]);
  });

  it("par défaut, n'inclut aucun texte personnel", () => {
    const dataset = buildWeeklyInsightDataset(source(), ENABLED);
    expect(dataset).not.toHaveProperty("reflections");
    expect(dataset).not.toHaveProperty("consumption_context");
    expect(dataset).not.toHaveProperty("craving_context");
    const json = JSON.stringify(dataset);
    expect(json).not.toContain("fictive");
    expect(json).not.toContain("Contexte");
  });

  it("n'inclut jamais d'identifiant, de courriel, de téléphone, de lettre, de contact ni de note", () => {
    const all: AiPreferences = { ...ENABLED, includeReflections: true, includeConsumptionContext: true, includeCravingContext: true };
    const json = JSON.stringify(buildWeeklyInsightDataset(source(), all));
    for (const marker of Object.values(SECRET_MARKERS)) expect(json).not.toContain(marker);
    expect(json).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    expect(json).not.toMatch(/@/);
    expect(json).not.toMatch(/user_id|substanceId|email|phone|letter|contact/i);
  });

  it("ajoute seulement les catégories autorisées", () => {
    const dataset = buildWeeklyInsightDataset(source(), { ...ENABLED, includeReflections: true });
    expect(dataset.reflections).toHaveLength(1);
    expect(dataset).not.toHaveProperty("consumption_context");
    const withCravings = buildWeeklyInsightDataset(source(), { ...ENABLED, includeCravingContext: true });
    expect(withCravings.craving_context).toEqual([expect.objectContaining({ context: "Contexte fictif d'envie.", helped: "Aide fictive." })]);
  });

  it("raccourcit les textes et limite le nombre de réflexions", () => {
    const long = "Phrase fictive. ".repeat(60);
    const reflections = Array.from({ length: 12 }, (_, index) => ({
      date: `2026-09-${String(10 + index).padStart(2, "0")}`,
      status: "sober" as const,
      victory: long,
      proudOf: null,
      lesson: null,
      tomorrowIntention: null,
    }));
    const dataset = buildWeeklyInsightDataset(source({ reflections }), { ...ENABLED, includeReflections: true });
    expect(dataset.reflections).toHaveLength(AI_LIMITS.maxReflections);
    for (const item of dataset.reflections ?? []) expect((item.victory ?? "").length).toBeLessThanOrEqual(AI_LIMITS.maxTextLength);
  });

  it("truncateForAi coupe à une fin de phrase ou de mot", () => {
    expect(truncateForAi("   ")).toBeNull();
    expect(truncateForAi("Court.")).toBe("Court.");
    expect(truncateForAi("Première phrase complète. Deuxième phrase plus longue", 40)).toBe("Première phrase complète.");
    expect(truncateForAi("motunique ".repeat(10), 25)).toMatch(/…$/);
  });

  it("le message envoyé ne contient que le jeu de données minimisé", () => {
    const dataset = buildWeeklyInsightDataset(source(), ENABLED);
    const message = buildWeeklyReflectionUserMessage(dataset);
    expect(message).toContain(JSON.stringify(dataset));
    expect(WEEKLY_REFLECTION_SYSTEM_PROMPT).toMatch(/Aucun diagnostic/);
    expect(WEEKLY_REFLECTION_SYSTEM_PROMPT).toMatch(/Aucune prédiction/);
  });
});

describe("validateWeeklyReflection — garde-fous", () => {
  const dataset = buildWeeklyInsightDataset(source(), ENABLED);

  it("accepte une sortie conforme et fondée", () => {
    expect(validateWeeklyReflection(validReflection(), dataset)).toMatchObject({ ok: true, removed: 0 });
  });

  it("refuse une sortie hors schéma", () => {
    expect(validateWeeklyReflection("texte", dataset)).toEqual({ ok: false, reason: "schema" });
    expect(validateWeeklyReflection({ ...validReflection(), summary: "Trop court" }, dataset)).toEqual({ ok: false, reason: "schema_summary" });
    expect(validateWeeklyReflection({ ...validReflection(), reflection_questions: ["Une seule question ?"] }, dataset)).toEqual({ ok: false, reason: "schema_reflection_questions" });
  });

  it("tronque les listes trop longues", () => {
    const tooMany = { ...validReflection(), progress: Array.from({ length: 4 }, (_, index) => ({ text: `Observation fictive numéro ${index}.`, evidence_keys: ["tracked_days"] })) };
    const result = validateWeeklyReflection(tooMany, dataset);
    expect(result.ok && result.reflection.progress).toHaveLength(3);
    expect(result.ok && result.removed).toBe(1);
  });

  it("retire une observation appuyée sur des données absentes ou inconnues", () => {
    const ungrounded = {
      ...validReflection(),
      progress: [
        { text: "Tes réflexions montrent une belle constance.", evidence_keys: ["reflections", "inventee"] },
        { text: "Tu as suivi cinq journées cette semaine.", evidence_keys: ["tracked_days", "inventee"] },
      ],
    };
    const result = validateWeeklyReflection(ungrounded, dataset);
    expect(result.ok && result.reflection.progress).toEqual([{ text: "Tu as suivi cinq journées cette semaine.", evidence_keys: ["tracked_days"] }]);
  });

  it.each([
    ["diagnostic", "Ces signes évoquent une dépression qui mérite attention."],
    ["prediction", "Tu risques une rechute la semaine prochaine si rien ne change."],
    ["causality", "Le stress cause tes consommations du vendredi."],
    ["judgment", "Cette journée a été un échec malgré tes efforts."],
    ["injunction", "Tu dois arrêter de sortir le vendredi soir."],
  ])("vocabulaire interdit (%s) : observation retirée, résumé refusé", (reason, text) => {
    const output = { ...validReflection(), recurring_themes: [{ text, evidence_keys: ["frequent_triggers"] }] };
    const filtered = validateWeeklyReflection(output, dataset);
    expect(filtered.ok && filtered.reflection.recurring_themes).toEqual([]);
    expect(JSON.stringify(filtered)).not.toContain(text);
    expect(validateWeeklyReflection({ ...validReflection(), summary: `${text} Résumé fictif de la semaine.` }, dataset)).toEqual({ ok: false, reason: `summary_${reason}` });
  });

  it("refuse la sortie s'il reste moins de 2 questions conformes", () => {
    const output = { ...validReflection(), reflection_questions: ["Qu'est-ce qui t'a aidé mardi ?", "Pourquoi as-tu échoué vendredi ?"] };
    expect(validateWeeklyReflection(output, dataset)).toEqual({ ok: false, reason: "schema_reflection_questions" });
  });
});

describe("generateWeeklyInsight — fournisseur simulé", () => {
  it("vérifie consentement, configuration et données suffisantes sans appeler le fournisseur", async () => {
    const provider = fakeProvider([{ ok: true, output: validReflection() }]);
    expect(checkWeeklyInsightPreconditions({ ...ENABLED, aiEnabled: false }, provider, 5)).toEqual({ ok: false, reason: "consent" });
    expect(checkWeeklyInsightPreconditions(ENABLED, null, 5)).toEqual({ ok: false, reason: "not_configured" });
    expect(checkWeeklyInsightPreconditions(ENABLED, provider, 2)).toEqual({ ok: false, reason: "insufficient_data" });
    const refused = await generateWeeklyInsight({ preferences: { ...ENABLED, aiEnabled: false }, source: source(), provider });
    expect(refused).toEqual({ ok: false, reason: "consent" });
    expect(provider.calls).toHaveLength(0);
  });

  it("renvoie un bilan validé", async () => {
    const provider = fakeProvider([{ ok: true, output: validReflection() }]);
    const result = await generateWeeklyInsight({ preferences: ENABLED, source: source(), provider });
    expect(result.ok).toBe(true);
    expect(provider.calls).toHaveLength(1);
    expect(JSON.stringify(provider.calls[0])).not.toContain(SECRET_MARKERS.uuid);
  });

  it("réessaie une fois après une sortie refusée, puis abandonne", async () => {
    const bad = { ...validReflection(), summary: "Cette semaine a été un échec pour toi, clairement." };
    const retried = fakeProvider([{ ok: true, output: bad }, { ok: true, output: validReflection() }]);
    expect((await generateWeeklyInsight({ preferences: ENABLED, source: source(), provider: retried })).ok).toBe(true);
    expect(retried.calls).toHaveLength(2);

    const failing = fakeProvider([{ ok: true, output: bad }]);
    expect(await generateWeeklyInsight({ preferences: ENABLED, source: source(), provider: failing })).toEqual({ ok: false, reason: "invalid_output" });
    expect(failing.calls).toHaveLength(2);
  });

  it("échec du fournisseur : rendu (non compté) sauf refus du modèle", async () => {
    for (const reason of ["refusal", "timeout", "unavailable", "error"] as const) {
      const provider = fakeProvider([{ ok: false, reason }]);
      const outcome = await generateWeeklyInsight({ preferences: ENABLED, source: source(), provider });
      expect(outcome).toEqual({ ok: false, reason: "provider", providerReason: reason });
      expect(isRefundableFailure(outcome)).toBe(reason !== "refusal");
      expect(provider.calls).toHaveLength(1);
    }
    const bad = { ...validReflection(), summary: "Cette semaine a été un échec pour toi, clairement." };
    const invalid = await generateWeeklyInsight({ preferences: ENABLED, source: source(), provider: fakeProvider([{ ok: true, output: bad }]) });
    expect(isRefundableFailure(invalid)).toBe(false);
  });

  it("période : 7 journées calendaires, aujourd'hui inclus", () => {
    expect(getWeeklyPeriod("2026-09-26")).toEqual({ start: "2026-09-20", end: "2026-09-26" });
    expect(getWeeklyPeriod("2026-03-03")).toEqual({ start: "2026-02-25", end: "2026-03-03" });
  });

  it("les clés de justification suivent les données présentes", () => {
    const keys = availableEvidenceKeys(buildWeeklyInsightDataset(source(), ENABLED));
    expect(keys.has("frequent_triggers")).toBe(true);
    expect(keys.has("reflections")).toBe(false);
  });
});
