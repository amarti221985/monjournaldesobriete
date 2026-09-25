import "server-only";

import {
  onboardingDraftSchema,
  type OnboardingCompletionPayload,
  type OnboardingDraft,
} from "@/features/onboarding/schemas";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export type StoredOnboardingDraft = {
  step: number;
  data: OnboardingDraft;
};

/**
 * Brouillon du wizard de l'utilisateur connecté (RLS), ou `null`.
 * Un brouillon illisible (schéma modifié) est ignoré plutôt que de bloquer l'accès.
 */
export async function getOnboardingDraft(userId: string): Promise<StoredOnboardingDraft | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("onboarding_drafts")
    .select("current_step, data")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[onboarding] Lecture du brouillon impossible", { code: error.code });
    return null;
  }
  if (!data) return null;

  const parsed = onboardingDraftSchema.safeParse(data.data);
  return parsed.success ? { step: data.current_step, data: parsed.data } : null;
}

/** Enregistre (ou remplace) le brouillon. `false` en cas d'échec, sans exception. */
export async function saveOnboardingDraft(
  userId: string,
  step: number,
  draft: OnboardingDraft,
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("onboarding_drafts")
    .upsert({ user_id: userId, current_step: step, data: draft as Json }, { onConflict: "user_id" });

  if (error) {
    console.error("[onboarding] Enregistrement du brouillon impossible", { code: error.code });
    return false;
  }
  return true;
}

export type CompleteOnboardingResult = "completed" | "already_completed" | "error";

/**
 * Finalisation atomique via la RPC public.complete_onboarding() (ADR-028) :
 * tout est enregistré dans une seule transaction, ou rien.
 */
export async function completeOnboarding(
  payload: OnboardingCompletionPayload,
): Promise<CompleteOnboardingResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_onboarding", {
    payload: payload as unknown as Json,
  });

  if (error) {
    // Message technique de la base (ex. invalid_reason) : jamais de donnée personnelle.
    console.error("[onboarding] Finalisation impossible", { code: error.code, reason: error.message });
    return "error";
  }
  return data === "already_completed" ? "already_completed" : "completed";
}
