import type { DayVisualStatus } from "@/config/day-status";
import type { Database } from "@/types/database";

/*
 * Valeurs métier (anglais, identiques aux enums / slugs PostgreSQL) et libellés
 * d'interface (français). Les libellés ne sont jamais stockés.
 */

export type CheckinStatus = Database["public"]["Enums"]["checkin_status"];

export const CHECKIN_STATUSES = [
  "sober",
  "sober_with_craving",
  "consumed",
] as const satisfies readonly CheckinStatus[];

export const statusOptions: Record<
  CheckinStatus,
  { label: string; description: string; visualStatus: DayVisualStatus }
> = {
  sober: {
    label: "Sobre",
    description: "Je n'ai pas consommé aujourd'hui.",
    visualStatus: "sober",
  },
  sober_with_craving: {
    label: "Sobre malgré une forte envie",
    description: "Ça a été difficile, mais je n'ai pas consommé.",
    visualStatus: "challenging",
  },
  consumed: {
    label: "J'ai consommé",
    description: "Je veux simplement noter ce qui s'est passé.",
    visualStatus: "consumed",
  },
};

export type ScoreKey = "moodScore" | "energyScore" | "stressScore" | "cravingScore";

export type ScoreDefinition = {
  key: ScoreKey;
  label: string;
  min: number;
  max: number;
  minLabel: string;
  maxLabel: string;
};

/** Mêmes bornes que les contraintes CHECK de daily_checkins. */
export const scoreDefinitions: readonly ScoreDefinition[] = [
  { key: "moodScore", label: "Humeur", min: 1, max: 10, minLabel: "Très difficile", maxLabel: "Excellente" },
  { key: "energyScore", label: "Énergie", min: 1, max: 10, minLabel: "Très faible", maxLabel: "Très élevée" },
  { key: "stressScore", label: "Stress", min: 1, max: 10, minLabel: "Très faible", maxLabel: "Très élevé" },
  { key: "cravingScore", label: "Envie de consommer", min: 0, max: 10, minLabel: "Aucune", maxLabel: "Très forte" },
];

/** Longueurs maximales (identiques aux contraintes CHECK). */
export const TEXT_LIMITS = {
  victoryText: 1000,
  proudOfText: 2000,
  lessonText: 2000,
  tomorrowIntentionText: 1000,
  notes: 5000,
  eventText: 2000,
  customLabel: 80,
  unit: 40,
} as const;

export const MAX_SELECTIONS = 20;
export const MAX_CONSUMPTION_EVENTS = 10;
export const MAX_QUANTITY = 10000;
export const OTHER_SLUG = "other";

export const checkinSteps = [
  { id: "status", title: "Ma journée" },
  { id: "scores", title: "Comment je me sens" },
  { id: "emotions", title: "Émotions" },
  { id: "triggers", title: "Déclencheurs" },
  // Étape conditionnelle : seulement si le statut est « consumed ».
  { id: "consumption", title: "Consommation" },
  { id: "achievements", title: "Mes actions et victoires" },
  { id: "reflection", title: "Réflexion" },
  { id: "summary", title: "Résumé" },
] as const;

export type CheckinStepId = (typeof checkinSteps)[number]["id"];

export const CHECKIN_SAVE_ERROR =
  "Nous n'avons pas pu enregistrer ton check-in. Tes réponses sont toujours disponibles. Réessaie dans quelques instants.";
