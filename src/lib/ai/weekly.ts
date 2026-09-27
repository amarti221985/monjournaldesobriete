import { buildWeeklyInsightDataset, type WeeklyInsightDataset, type WeeklyInsightSource } from "@/lib/ai/dataset";
import { validateWeeklyReflection } from "@/lib/ai/guardrails";
import { AI_LIMITS, type AiPreferences } from "@/lib/ai/privacy";
import type { AiProvider } from "@/lib/ai/provider";
import type { WeeklyReflection } from "@/lib/ai/schemas";
import { addDays } from "@/lib/dates";

/*
 * Génération d'un bilan hebdomadaire (ADR-082 à ADR-087), indépendante du fournisseur
 * (injecté) : testable avec un fournisseur simulé. Ne persiste rien.
 */

/** Période du bilan : 7 derniers jours calendaires, aujourd'hui inclus (fuseau du profil). */
export function getWeeklyPeriod(today: string): { start: string; end: string } {
  return { start: addDays(today, -(AI_LIMITS.periodDays - 1)), end: today };
}

export type WeeklyInsightOutcome =
  | { ok: true; reflection: WeeklyReflection; dataset: WeeklyInsightDataset }
  | { ok: false; reason: "consent" | "not_configured" | "insufficient_data" | "provider" | "invalid_output" };

/** Contrôles préalables, sans appel au fournisseur (aucune génération consommée). */
export function checkWeeklyInsightPreconditions(
  preferences: AiPreferences,
  provider: AiProvider | null,
  checkinCount: number,
): Extract<WeeklyInsightOutcome, { ok: false }> | null {
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
      return { ok: false, reason: "provider" };
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
