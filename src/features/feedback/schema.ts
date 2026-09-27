import { z } from "zod";

/*
 * Avis des bêta-testeurs (Sprint 13). Le message est rédigé volontairement par la personne ;
 * la section concernée est CHOISIE (jamais déduite de l'URL ni du journal).
 */

export const FEEDBACK_CATEGORIES = ["bug", "confusing", "suggestion", "like"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const feedbackCategoryLabels: Record<FeedbackCategory, string> = {
  bug: "Bug",
  confusing: "Je ne comprends pas",
  suggestion: "Suggestion",
  like: "Ce que j'aime",
};

export const FEEDBACK_SECTIONS = [
  "today",
  "checkin",
  "calendar",
  "journal",
  "progress",
  "craving",
  "plan",
  "achievements",
  "insights",
  "settings",
  "report",
  "onboarding",
  "other",
] as const;
export type FeedbackSection = (typeof FEEDBACK_SECTIONS)[number];

export const feedbackSectionLabels: Record<FeedbackSection, string> = {
  today: "Aujourd'hui",
  checkin: "Check-in",
  calendar: "Calendrier",
  journal: "Journal",
  progress: "Progression",
  craving: "Mode envie",
  plan: "Mon plan",
  achievements: "Accomplissements",
  insights: "Mes bilans",
  settings: "Paramètres",
  report: "Rapport PDF",
  onboarding: "Configuration du parcours",
  other: "Autre",
};

export const FEEDBACK_MESSAGE_MAX = 2000;

export const feedbackSchema = z.object({
  category: z.enum(FEEDBACK_CATEGORIES, { error: "Choisis un type d'avis." }),
  message: z
    .string()
    .trim()
    .min(1, "Écris quelques mots.")
    .max(FEEDBACK_MESSAGE_MAX, `${FEEDBACK_MESSAGE_MAX} caractères au maximum.`),
  section: z.enum(FEEDBACK_SECTIONS).nullable(),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;
