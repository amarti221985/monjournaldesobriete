"use server";

import { z } from "zod";

import { COMPLETION_ERROR_MESSAGE } from "@/features/onboarding/constants";
import {
  createOnboardingCompletionSchema,
  draftStepSchema,
  onboardingDraftSchema,
} from "@/features/onboarding/schemas";
import { getCurrentUser } from "@/lib/auth/session";
import { getLatestAllowedLocalDate } from "@/lib/dates";
import { completeOnboarding, saveOnboardingDraft } from "@/lib/services/onboarding";
import { getCurrentProfile } from "@/lib/services/profiles";

/*
 * Server Actions de l'onboarding. L'identité vient toujours de la session ;
 * toutes les entrées sont revalidées ici (et une dernière fois par la base).
 */

const saveDraftInputSchema = z.object({
  step: draftStepSchema,
  draft: onboardingDraftSchema,
});

/** Sauvegarde automatique du brouillon. Retourne `false` sans lever d'erreur en cas d'échec. */
export async function saveOnboardingDraftAction(input: unknown): Promise<boolean> {
  const parsed = saveDraftInputSchema.safeParse(input);
  if (!parsed.success) return false;

  const user = await getCurrentUser();
  if (!user) return false;
  const profile = await getCurrentProfile();
  if (!profile || profile.onboarding_completed) return false;

  return saveOnboardingDraft(user.id, parsed.data.step, parsed.data.draft);
}

export type CompleteOnboardingState =
  | { status: "success" }
  | { status: "error"; message: string };

export async function completeOnboardingAction(input: unknown): Promise<CompleteOnboardingState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Ta session a expiré. Reconnecte-toi pour terminer." };
  }
  const profile = await getCurrentProfile();
  if (profile?.onboarding_completed) return { status: "success" };

  const latestAllowedDate = getLatestAllowedLocalDate(profile?.timezone);
  const parsed = createOnboardingCompletionSchema(latestAllowedDate).safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Certaines réponses sont incomplètes. Utilise « Modifier » pour les vérifier.",
    };
  }

  const result = await completeOnboarding(parsed.data);
  return result === "error"
    ? { status: "error", message: COMPLETION_ERROR_MESSAGE }
    : { status: "success" };
}
