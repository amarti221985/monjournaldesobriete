"use server";

import { feedbackSchema } from "@/features/feedback/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { notifyFeedback } from "@/lib/services/notifications";
import { createClient } from "@/lib/supabase/server";

export type FeedbackState =
  | { status: "idle" }
  | { status: "sent" }
  | { status: "error"; message: string; fieldErrors?: Partial<Record<"category" | "message", string>> };

/**
 * Enregistre un avis de l'utilisateur connecté (identité issue de la session, RLS). Aucun
 * contenu n'est journalisé : seulement un code technique en cas d'erreur.
 */
export async function sendFeedbackAction(input: unknown): Promise<FeedbackState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Ta session a expiré. Reconnecte-toi pour continuer." };

  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<"category" | "message", string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if ((field === "category" || field === "message") && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { status: "error", message: "Vérifie les champs indiqués.", fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("beta_feedback").insert({
    user_id: user.id,
    category: parsed.data.category,
    message: parsed.data.message,
    page_context: parsed.data.section,
  });
  if (error) {
    if (error.message === "feedback_rate_limited") {
      return { status: "error", message: "Tu as envoyé beaucoup d'avis aujourd'hui. Merci ! Réessaie demain." };
    }
    console.error("[feedback] Envoi impossible", { code: error.code });
    return { status: "error", message: "Ton avis n'a pas pu être envoyé. Réessaie dans quelques instants." };
  }
  // Notification au propriétaire (si Resend est configuré) ; un échec n'annule jamais l'avis.
  await notifyFeedback(parsed.data);
  return { status: "sent" };
}
