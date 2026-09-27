import { buildWeeklyInsightDataset, type WeeklyInsightDataset, type WeeklyInsightSource } from "@/lib/ai/dataset";
import { validateWeeklyReflection } from "@/lib/ai/guardrails";
import { AI_LIMITS, type AiPreferences } from "@/lib/ai/privacy";
import type { AiProvider, ProviderOutcome } from "@/lib/ai/provider";
import type { WeeklyReflection } from "@/lib/ai/schemas";
import { addDays } from "@/lib/dates";

/*
 * Génération d'un bilan hebdomadaire (ADR-082 à ADR-087), indépendante du fournisseur
 * (injecté) : testable avec un fournisseur simulé. Ne persiste rien.
 */

/**
 * Moment à partir duquel un nouveau bilan est possible (fenêtre glissante de 24 h depuis la
 * dernière génération), ou null s'il est possible maintenant. La base applique la même règle.
 */
export function getNextGenerationAt(lastGenerationAt: string | null, now: Date = new Date()): Date | null {
  if (!lastGenerationAt) return null;
  const next = new Date(Date.parse(lastGenerationAt) + AI_LIMITS.generationCooldownHours * 3_600_000);
  return Number.isNaN(next.getTime()) || next <= now ? null : next;
}

/** Période du bilan : 7 derniers jours calendaires, aujourd'hui inclus (fuseau du profil). */
export function getWeeklyPeriod(today: string): { start: string; end: string } {
  return { start: addDays(today, -(AI_LIMITS.periodDays - 1)), end: today };
}

export type WeeklyInsightOutcome =
  | { ok: true; reflection: WeeklyReflection; dataset: WeeklyInsightDataset }
  | PreconditionFailure
  | { ok: false; reason: "invalid_output" }
  | { ok: false; reason: "provider"; providerReason: Exclude<ProviderFailure, "invalid_output"> };

export type PreconditionFailure = { ok: false; reason: "consent" | "not_configured" | "insufficient_data" };

type ProviderFailure = Extract<ProviderOutcome, { ok: false }>["reason"];

/**
 * Un échec est « rendu » (non compté dans la limite) quand aucun bilan n'a pu être produit
 * pour une raison extérieure au contenu : clé, crédits, service indisponible, délai. Un
 * refus du modèle ou une sortie refusée par les garde-fous restent comptés.
 */
export function isRefundableFailure(outcome: WeeklyInsightOutcome): boolean {
  return !outcome.ok && outcome.reason === "provider" && outcome.providerReason !== "refusal";
}

/** Contrôles préalables, sans appel au fournisseur (aucune génération consommée). */
export function checkWeeklyInsightPreconditions(
  preferences: AiPreferences,
  provider: AiProvider | null,
  checkinCount: number,
): PreconditionFailure | null {
  if (!preferences.aiEnabled) return { ok: false, reason: "consent" };
  if (!provider) return { ok: false, reason: "not_configured" };
  if (checkinCount < AI_LIMITS.minCheckins) return { ok: false, reason: "insufficient_data" };
  return null;
}

/**
 * Construit le jeu de données minimisé, appelle le fournisseur, valide la sortie (schéma
 * strict + garde-fous). Une seule nouvelle tentative si la sortie est refusée.
 */
export async function generateWeeklyInsight(input: {
  preferences: AiPreferences;
  source: WeeklyInsightSource;
  provider: AiProvider | null;
}): Promise<WeeklyInsightOutcome> {
  const blocked = checkWeeklyInsightPreconditions(input.preferences, input.provider, input.source.checkins.length);
  if (blocked || !input.provider) return blocked ?? { ok: false, reason: "not_configured" };

  const dataset = buildWeeklyInsightDataset(input.source, input.preferences);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const outcome = await input.provider.generateWeeklyReflection(dataset);
    if (!outcome.ok) {
      console.warn("[ai] bilan non obtenu", { attempt: attempt + 1, reason: outcome.reason });
      if (outcome.reason === "invalid_output") continue;
      return { ok: false, reason: "provider", providerReason: outcome.reason };
    }
    const validated = validateWeeklyReflection(outcome.output, dataset);
    // Codes techniques seulement (jamais le texte du bilan).
    if (validated.ok) {
      if (validated.removed > 0) console.info("[ai] bilan filtré", { removed: validated.removed });
      return { ok: true, reflection: validated.reflection, dataset };
    }
    console.warn("[ai] bilan refusé par les garde-fous", { attempt: attempt + 1, reason: validated.reason });
  }
  return { ok: false, reason: "invalid_output" };
}
