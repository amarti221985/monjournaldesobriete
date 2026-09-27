"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { routes } from "@/config/routes";
import { getConfiguredAiProvider } from "@/lib/ai/anthropic-provider";
import { PROMPT_VERSION } from "@/lib/ai/prompts";
import { checkWeeklyInsightPreconditions, generateWeeklyInsight, getNextGenerationAt, getWeeklyPeriod, isRefundableFailure } from "@/lib/ai/weekly";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDateTimeInZone, getUserToday } from "@/lib/dates";
import {
  collectWeeklyInsightSource,
  deleteAiReflection,
  deleteAllAiReflections,
  getAiPreferences,
  releaseAiGeneration,
  reserveAiGeneration,
  saveAiPreferences,
  saveAiReflection,
} from "@/lib/services/ai";
import { getCurrentProfile } from "@/lib/services/profiles";

/*
 * Server Actions des bilans intelligents (Sprint 12). Ordre imposé : session →
 * consentement → période → données autorisées → minimisation → fournisseur → validation
 * → persistance. Aucun user_id du navigateur ; aucun contenu journalisé.
 */

export type InsightActionState = { status: "ok"; message?: string } | { status: "error"; message: string };

const SESSION_EXPIRED: InsightActionState = { status: "error", message: "Ta session a expiré. Reconnecte-toi pour continuer." };
const GENERATION_ERROR = "Impossible de générer ton bilan pour le moment. Tes données n'ont pas été modifiées.";
const GENERATION_NOT_COUNTED =
  "Impossible de générer ton bilan pour le moment. Cet essai n'est pas compté dans ta limite d'un bilan par 24 heures, et tes données n'ont pas été modifiées.";

function rateLimitMessage(next: Date | null, timezone: string | null | undefined): string {
  const base = "Tu peux créer un bilan par période de 24 heures.";
  return next ? `${base} Le prochain sera possible ${formatDateTimeInZone(next, timezone)}.` : `${base} Réessaie un peu plus tard.`;
}

function revalidate() {
  revalidatePath(routes.insights);
  revalidatePath(routes.settings);
}

const preferencesSchema = z.object({
  aiEnabled: z.boolean(),
  includeReflections: z.boolean(),
  includeConsumptionContext: z.boolean(),
  includeCravingContext: z.boolean(),
  /** Activation : l'écran de consentement doit avoir été présenté et accepté. */
  consentAcknowledged: z.boolean().optional(),
});

export async function updateAiPreferencesAction(input: unknown): Promise<InsightActionState> {
  const user = await getCurrentUser();
  if (!user) return SESSION_EXPIRED;
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Préférences invalides." };
  const current = await getAiPreferences(user.id);
  if (parsed.data.aiEnabled && !current.aiEnabled && parsed.data.consentAcknowledged !== true) {
    return { status: "error", message: "Lis et accepte les informations sur les bilans intelligents pour les activer." };
  }
  const saved = await saveAiPreferences(user.id, {
    aiEnabled: parsed.data.aiEnabled,
    includeReflections: parsed.data.includeReflections,
    includeConsumptionContext: parsed.data.includeConsumptionContext,
    includeCravingContext: parsed.data.includeCravingContext,
  });
  if (!saved) return { status: "error", message: "Nous n'avons pas pu enregistrer tes préférences. Réessaie dans quelques instants." };
  revalidate();
  return { status: "ok", message: parsed.data.aiEnabled ? "Préférences enregistrées." : "Les bilans intelligents sont désactivés." };
}

/** Génère (ou régénère, en remplaçant) le bilan des 7 derniers jours. */
export async function generateWeeklyInsightAction(): Promise<InsightActionState> {
  const user = await getCurrentUser();
  if (!user) return SESSION_EXPIRED;

  const preferences = await getAiPreferences(user.id);
  const provider = getConfiguredAiProvider();
  const timezone = (await getCurrentProfile())?.timezone;
  const today = getUserToday(timezone);
  const period = getWeeklyPeriod(today);

  let source;
  try {
    source = await collectWeeklyInsightSource(user.id, period, preferences);
  } catch {
    return { status: "error", message: GENERATION_ERROR };
  }

  // Contrôles AVANT de consommer une génération.
  const blocked = checkWeeklyInsightPreconditions(preferences, provider, source.checkins.length);
  if (blocked) {
    if (blocked.reason === "consent") return { status: "error", message: "Active d'abord les bilans intelligents." };
    if (blocked.reason === "not_configured") return { status: "error", message: "Les bilans intelligents ne sont pas disponibles pour le moment." };
    return { status: "error", message: "Il n'y a pas encore assez de journées enregistrées pour créer un bilan utile." };
  }

  const reserved = await reserveAiGeneration();
  if (!reserved.ok) {
    if (reserved.reason === "rate_limited") {
      const next = getNextGenerationAt((await getAiPreferences(user.id)).lastGenerationAt);
      return { status: "error", message: rateLimitMessage(next, timezone) };
    }
    return { status: "error", message: reserved.reason === "consent" ? "Active d'abord les bilans intelligents." : GENERATION_ERROR };
  }

  const outcome = await generateWeeklyInsight({ preferences, source, provider });
  if (!outcome.ok || !provider) {
    // Échec extérieur au contenu (clé, crédits, service) : l'essai n'est pas compté.
    if (isRefundableFailure(outcome) && (await releaseAiGeneration(reserved.reservation))) {
      return { status: "error", message: GENERATION_NOT_COUNTED };
    }
    return { status: "error", message: GENERATION_ERROR };
  }

  const saved = await saveAiReflection({
    periodStart: period.start,
    periodEnd: period.end,
    reflection: outcome.reflection,
    provider: provider.name,
    model: provider.model,
    promptVersion: PROMPT_VERSION,
  });
  if (!saved) return { status: "error", message: GENERATION_ERROR };
  revalidate();
  return { status: "ok" };
}

export async function deleteAiReflectionAction(id: unknown): Promise<InsightActionState> {
  const user = await getCurrentUser();
  if (!user) return SESSION_EXPIRED;
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { status: "error", message: "Ce bilan est introuvable." };
  const deleted = await deleteAiReflection(user.id, parsed.data);
  if (!deleted) return { status: "error", message: "Ce bilan est introuvable." };
  revalidate();
  return { status: "ok", message: "Bilan supprimé." };
}

export async function deleteAllAiReflectionsAction(): Promise<InsightActionState> {
  const user = await getCurrentUser();
  if (!user) return SESSION_EXPIRED;
  const deleted = await deleteAllAiReflections(user.id);
  if (!deleted) return { status: "error", message: "Nous n'avons pas pu supprimer tes bilans. Réessaie dans quelques instants." };
  revalidate();
  return { status: "ok", message: "Tes bilans intelligents ont été supprimés." };
}
