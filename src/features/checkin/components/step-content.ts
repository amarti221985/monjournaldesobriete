import type { CheckinStepId } from "@/features/checkin/constants";

/**
 * Formulation selon la journée : pour une journée passée, « aujourd'hui » devient « ce jour-là »
 * et « demain » devient « le lendemain ».
 */
export function forCheckinDay(text: string, isPastDay: boolean): string {
  if (!isPastDay) return text;
  return text.replace(/aujourd'hui/g, "ce jour-là").replace(/pour demain/g, "pour le lendemain");
}

/** Question et sous-titre de chaque étape du check-in. */
export const checkinStepContent: Record<CheckinStepId, { heading: string; description?: string }> = {
  status: { heading: "Comment s'est passée ta journée?" },
  scores: {
    heading: "Comment te sens-tu?",
    description: "Choisis la valeur qui correspond le mieux à ta journée.",
  },
  emotions: { heading: "Qu'as-tu ressenti aujourd'hui?" },
  triggers: {
    heading: "As-tu rencontré un déclencheur aujourd'hui?",
    description: "Une situation, une émotion ou un moment qui a pu donner envie de consommer.",
  },
  consumption: { heading: "Regardons ce qui s'est passé" },
  achievements: {
    heading: "Qu'as-tu accompli aujourd'hui?",
    description: "Coche ce qui s'applique. Tout compte, même les petites choses.",
  },
  reflection: {
    heading: "Un moment de réflexion",
    description: "Tout est facultatif. Quelques mots suffisent.",
  },
  summary: {
    heading: "Ma journée en résumé",
    description: "Vérifie tes réponses. Tu peux encore les modifier.",
  },
};
