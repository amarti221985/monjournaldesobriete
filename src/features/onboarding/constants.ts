import {
  Brain,
  Briefcase,
  Feather,
  HeartPulse,
  House,
  Moon,
  Plus,
  Sparkles,
  Sprout,
  Users,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";

import type { Database } from "@/types/database";

/*
 * Valeurs métier (anglais, stables, identiques aux enums PostgreSQL) et libellés
 * d'interface (français). Ne jamais stocker les libellés.
 */

export type SubstanceGoal = Database["public"]["Enums"]["substance_goal"];
export type Motivation = Database["public"]["Enums"]["motivation"];

export const SUBSTANCE_GOALS = [
  "abstinence",
  "reduction",
  "observation",
] as const satisfies readonly SubstanceGoal[];

export const MOTIVATIONS = [
  "health",
  "energy",
  "sleep",
  "relationships",
  "family",
  "confidence",
  "finances",
  "career",
  "freedom",
  "clarity",
  "personal_project",
  "other",
] as const satisfies readonly Motivation[];

export const MAX_TRACKED_SUBSTANCES = 6;
export const OTHER_SUBSTANCE_SLUG = "other";

export const goalOptions: Record<SubstanceGoal, { label: string; description: string }> = {
  abstinence: {
    label: "Arrêter complètement",
    description: "Je souhaite ne plus consommer cette substance.",
  },
  reduction: {
    label: "Réduire ma consommation",
    description: "Je souhaite diminuer ma consommation et mieux la comprendre.",
  },
  observation: {
    label: "Observer ma consommation",
    description: "Je souhaite commencer par suivre ma consommation et mes habitudes.",
  },
};

export const motivationOptions: Record<Motivation, { label: string; icon: LucideIcon }> = {
  health: { label: "Santé", icon: HeartPulse },
  energy: { label: "Énergie", icon: Zap },
  sleep: { label: "Sommeil", icon: Moon },
  relationships: { label: "Relations", icon: Users },
  family: { label: "Famille", icon: House },
  confidence: { label: "Confiance", icon: Sparkles },
  finances: { label: "Argent", icon: Wallet },
  career: { label: "Travail / carrière", icon: Briefcase },
  freedom: { label: "Liberté", icon: Feather },
  clarity: { label: "Clarté mentale", icon: Brain },
  personal_project: { label: "Projet personnel", icon: Sprout },
  other: { label: "Autre", icon: Plus },
};

/**
 * Catégories pour lesquelles un arrêt brusque peut nécessiter un accompagnement
 * médical : une information discrète est affichée si l'objectif est l'arrêt complet.
 */
export const WITHDRAWAL_NOTICE_SLUGS: readonly string[] = ["alcohol", "opioids", OTHER_SUBSTANCE_SLUG];

export const WITHDRAWAL_NOTICE =
  "Pour certaines substances, arrêter brusquement peut nécessiter un accompagnement médical. Si tu as des inquiétudes concernant le sevrage, consulte un professionnel de la santé.";

export const onboardingSteps = [
  { id: "welcome", title: "Bienvenue" },
  { id: "substances", title: "Ce que je veux changer" },
  { id: "goals", title: "Mon objectif" },
  { id: "start", title: "Mon point de départ" },
  { id: "reason", title: "Pourquoi je fais ce changement" },
  { id: "motivations", title: "Ce qui compte pour moi" },
  { id: "support", title: "Mon soutien" },
  { id: "summary", title: "Résumé" },
] as const;

export type OnboardingStepId = (typeof onboardingSteps)[number]["id"];

export const ONBOARDING_STEP_COUNT = onboardingSteps.length;

export const COMPLETION_ERROR_MESSAGE =
  "Nous n'avons pas pu enregistrer ton parcours. Tes réponses sont toujours disponibles. Réessaie dans quelques instants.";
