import type { OnboardingStepId } from "@/features/onboarding/constants";

/** Titre (question) et sous-titre affichés pour chaque étape. */
export const stepContent: Record<OnboardingStepId, { heading: string; description?: string }> = {
  welcome: {
    heading: "Bienvenue",
    description: "Commençons par personnaliser ton parcours.",
  },
  substances: {
    heading: "Qu'aimerais-tu changer?",
    description: "Choisis une ou plusieurs options.",
  },
  goals: {
    heading: "Quel est ton objectif?",
    description: "Tu peux choisir un objectif différent pour chaque élément et l'ajuster plus tard.",
  },
  start: {
    heading: "Quand ton parcours a-t-il commencé?",
    description: "Choisis la date qui représente le mieux le début de ton parcours actuel.",
  },
  reason: {
    heading: "Pourquoi veux-tu faire ce changement?",
    description:
      "Il n'y a pas de bonne ou de mauvaise réponse. Écris simplement ce qui compte pour toi aujourd'hui.",
  },
  motivations: {
    heading: "Qu'est-ce que tu veux retrouver ou protéger?",
    description: "Choisis tout ce qui compte pour toi.",
  },
  support: {
    heading: "Y a-t-il quelqu'un sur qui tu peux compter?",
    description:
      "Tu peux ajouter une personne que tu pourrais vouloir contacter lorsque les choses deviennent plus difficiles.",
  },
  summary: {
    heading: "Ton parcours",
    description: "Vérifie tes réponses. Tu peux encore les modifier.",
  },
};
