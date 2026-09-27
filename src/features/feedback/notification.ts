import { feedbackCategoryLabels, feedbackSectionLabels, type FeedbackInput } from "@/features/feedback/schema";

/*
 * Notification d'un avis bêta au propriétaire (Resend). Fonctions pures, testées : texte brut
 * seulement (aucun HTML, donc aucune injection), jamais l'adresse courriel ni l'identifiant de
 * la personne (la page d'avis promet que seul le message et la section sont transmis).
 */

export type FeedbackNotificationConfig = { apiKey: string; to: string; from: string };

/** Expéditeur par défaut de Resend : n'envoie qu'à l'adresse du compte Resend (suffisant ici). */
export const DEFAULT_FEEDBACK_FROM = "Mon Journal de Sobriété <onboarding@resend.dev>";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Configuration valide, ou null (notification désactivée : l'avis reste enregistré en base). */
export function resolveFeedbackNotificationConfig(source: {
  apiKey: string | undefined;
  to: string | undefined;
  from: string | undefined;
}): FeedbackNotificationConfig | null {
  if (!source.apiKey || !source.to || !EMAIL.test(source.to)) return null;
  return { apiKey: source.apiKey, to: source.to, from: source.from || DEFAULT_FEEDBACK_FROM };
}

export function buildFeedbackEmail(feedback: FeedbackInput, receivedAt: Date = new Date()) {
  const category = feedbackCategoryLabels[feedback.category];
  const section = feedback.section ? feedbackSectionLabels[feedback.section] : "Aucune en particulier";
  const date = new Intl.DateTimeFormat("fr-CA", { dateStyle: "long", timeStyle: "short", timeZone: "America/Toronto" }).format(receivedAt);
  return {
    subject: `Nouvel avis bêta : ${category}`,
    text: [
      `Type : ${category}`,
      `Section : ${section}`,
      `Reçu le : ${date}`,
      "",
      feedback.message,
      "",
      "—",
      "Tous les avis : table beta_feedback dans Supabase.",
    ].join("\n"),
  };
}
