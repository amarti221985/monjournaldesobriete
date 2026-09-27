import { z } from "zod";

import { optionalText } from "@/features/checkin/schemas";
import {
  createStartDateSchema,
  customNameSchema,
  motivationOtherSchema,
  motivationsSchema,
  reasonSchema,
  substanceGoalSchema,
  substanceSlugSchema,
  supportContactSchema,
} from "@/features/onboarding/schemas";
import { PLAN_STRATEGY_DURATIONS, PLAN_TEXT_LIMITS } from "@/features/plan/constants";

/**
 * Schémas de « Mon plan », partagés client / serveur. Réutilisent ceux de l'onboarding
 * (mêmes règles pour substances, raison, motivations et contacts). Les RPC, les
 * contraintes et la RLS revalident tout ; les identifiants de catalogue ne sont jamais
 * acceptés du navigateur (slugs résolus côté base).
 */

export const planIdSchema = z.uuid();

const catalogueSlugSchema = z.string().regex(/^[a-z][a-z0-9_]{1,39}$/, "Choix invalide.");

function requiredText(max: number, empty: string) {
  return z
    .string({ error: empty })
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1, empty).max(max, `${max} caractères maximum.`));
}

/** Texte long (lettre, rappel) : sauts de ligne conservés, espaces de bord retirés. */
function requiredLongText(max: number, empty: string) {
  return z
    .string({ error: empty })
    .transform((value) => value.trim())
    .pipe(z.string().min(1, empty).max(max, `${max} caractères maximum.`));
}

// --- Mon parcours ------------------------------------------------------------------

export function createUpdateSubstanceSchema(latestAllowedDate: string) {
  return z.object({
    id: planIdSchema,
    goal: substanceGoalSchema,
    startedOn: createStartDateSchema(latestAllowedDate),
    customName: customNameSchema,
  });
}

export function createAddSubstanceSchema(latestAllowedDate: string) {
  return z.object({
    slug: substanceSlugSchema,
    customName: customNameSchema,
    goal: substanceGoalSchema,
    startedOn: createStartDateSchema(latestAllowedDate),
  });
}

// --- Raison et motivations ----------------------------------------------------------

export const planReasonSchema = z.object({ reason: reasonSchema });

export const planMotivationsSchema = z
  .object({ motivations: motivationsSchema, otherLabel: motivationOtherSchema })
  .transform((value) => ({
    motivations: value.motivations,
    otherLabel: value.motivations.includes("other") ? value.otherLabel : undefined,
  }));

// --- Déclencheurs personnels --------------------------------------------------------

export const personalTriggerSchema = z
  .object({
    triggerSlug: catalogueSlugSchema.nullable(),
    customLabel: optionalText(PLAN_TEXT_LIMITS.triggerLabel),
    notes: optionalText(PLAN_TEXT_LIMITS.triggerNotes),
  })
  .refine((value) => value.triggerSlug !== null || value.customLabel !== undefined, {
    path: ["customLabel"],
    message: "Décris ce déclencheur en quelques mots.",
  })
  .transform((value) => ({ ...value, customLabel: value.triggerSlug === null ? value.customLabel : undefined }));

export const personalTriggerNotesSchema = z.object({
  id: planIdSchema,
  notes: optionalText(PLAN_TEXT_LIMITS.triggerNotes),
});

// --- Stratégies personnelles --------------------------------------------------------

export const planDurationSchema = z
  .number()
  .int()
  .nullable()
  .refine((value) => (PLAN_STRATEGY_DURATIONS as readonly (number | null)[]).includes(value), "Durée invalide.");

export const personalStrategySchema = z
  .object({
    strategySlug: catalogueSlugSchema.nullable(),
    customName: optionalText(PLAN_TEXT_LIMITS.strategyName),
    notes: optionalText(PLAN_TEXT_LIMITS.strategyNotes),
    defaultDurationMinutes: planDurationSchema,
  })
  .refine((value) => value.strategySlug !== null || value.customName !== undefined, {
    path: ["customName"],
    message: "Donne un nom à ta stratégie.",
  })
  .transform((value) => ({ ...value, customName: value.strategySlug === null ? value.customName : undefined }));

export const updatePersonalStrategySchema = z.object({
  id: planIdSchema,
  customName: optionalText(PLAN_TEXT_LIMITS.strategyName),
  notes: optionalText(PLAN_TEXT_LIMITS.strategyNotes),
  defaultDurationMinutes: planDurationSchema,
});

export const favoriteSchema = z.object({ id: planIdSchema, favorite: z.boolean() });

// --- Personnes de soutien -----------------------------------------------------------

export const planContactSchema = supportContactSchema;
export const updatePlanContactSchema = supportContactSchema.extend({ id: planIdSchema });

// --- Lieux sûrs ---------------------------------------------------------------------

export const safePlaceSchema = z.object({
  name: requiredText(PLAN_TEXT_LIMITS.placeName, "Donne un nom à ce lieu."),
  description: optionalText(PLAN_TEXT_LIMITS.placeDescription),
});

export const updateSafePlaceSchema = safePlaceSchema.extend({ id: planIdSchema });

// --- Rappel et lettre ---------------------------------------------------------------

export const reminderSchema = z.object({
  content: requiredLongText(PLAN_TEXT_LIMITS.reminder, "Écris quelques mots à te rappeler."),
});

export const letterSchema = z.object({
  title: optionalText(PLAN_TEXT_LIMITS.letterTitle),
  content: requiredLongText(PLAN_TEXT_LIMITS.letter, "Écris quelques mots à relire."),
});
