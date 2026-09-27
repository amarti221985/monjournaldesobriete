import { z } from "zod";

import { OTHER_SLUG } from "@/features/checkin/constants";
import { optionalText } from "@/features/checkin/schemas";
import {
  CRAVING_DURATION_OPTIONS,
  CRAVING_TEXT_LIMITS,
  MAX_CRAVING_SELECTIONS,
  MAX_CRAVING_SUBSTANCES,
  MAX_PLANNED_DURATION_MINUTES,
} from "@/features/craving/constants";

/**
 * Schémas du mode envie, partagés client / serveur. Les RPC (start_craving_event,
 * start_craving_intervention, complete_craving_event) et les contraintes revalident.
 */

export const cravingScoreSchema = z
  .number({ error: "Choisis une valeur entre 0 et 10." })
  .int("Choisis une valeur entre 0 et 10.")
  .min(0, "Choisis une valeur entre 0 et 10.")
  .max(10, "Choisis une valeur entre 0 et 10.");

const catalogueSlugSchema = z.string().regex(/^[a-z][a-z0-9_]{1,39}$/, "Choix invalide.");

function unique<T>(items: readonly T[], key: (item: T) => string) {
  return new Set(items.map(key)).size === items.length;
}

export const cravingSubstanceIdsSchema = z
  .array(z.uuid("Choix invalide."))
  .min(1, "Choisis au moins une substance.")
  .max(MAX_CRAVING_SUBSTANCES)
  .refine((items) => unique(items, (item) => item), "Choix en double.");

export const cravingEmotionsSchema = z
  .array(catalogueSlugSchema)
  .max(MAX_CRAVING_SELECTIONS)
  .refine((items) => unique(items, (item) => item), "Choix en double.");

export const cravingTriggersSchema = z
  .array(
    z
      .object({ slug: catalogueSlugSchema, customLabel: optionalText(CRAVING_TEXT_LIMITS.customLabel) })
      .transform(({ slug, customLabel }) => ({ slug, customLabel: slug === OTHER_SLUG ? customLabel : undefined })),
  )
  .max(MAX_CRAVING_SELECTIONS)
  .refine((items) => unique(items, (item) => item.slug), "Choix en double.");

/** Étape 1 : ce qui se passe maintenant. `id` généré par le client (idempotence). */
export const startCravingEventSchema = z
  .object({
    id: z.uuid(),
    initialCravingScore: cravingScoreSchema,
    substanceIds: cravingSubstanceIdsSchema,
    emotions: cravingEmotionsSchema,
    triggers: cravingTriggersSchema,
    triggerUnknown: z.boolean(),
    contextText: optionalText(CRAVING_TEXT_LIMITS.contextText),
  })
  .refine((value) => !(value.triggerUnknown && value.triggers.length > 0), {
    path: ["triggers"],
    message: "« Je ne sais pas » ne peut pas être combiné avec un déclencheur.",
  });

export type StartCravingEventPayload = z.output<typeof startCravingEventSchema>;

export const plannedDurationSchema = z
  .number()
  .int()
  .min(1)
  .max(MAX_PLANNED_DURATION_MINUTES)
  .nullable()
  .refine((value) => (CRAVING_DURATION_OPTIONS as readonly (number | null)[]).includes(value), "Durée invalide.");

/** Étape 2 : une stratégie du catalogue OU une stratégie personnelle, et une durée. */
export const startInterventionSchema = z
  .object({
    strategySlug: catalogueSlugSchema.nullable(),
    customStrategyText: optionalText(CRAVING_TEXT_LIMITS.customStrategyText),
    plannedDurationMinutes: plannedDurationSchema,
  })
  .refine((value) => value.strategySlug !== null || value.customStrategyText !== undefined, {
    path: ["customStrategyText"],
    message: "Écris la stratégie que tu veux essayer.",
  })
  .transform((value) => ({
    ...value,
    customStrategyText: value.strategySlug === null ? value.customStrategyText : undefined,
  }));

export type StartInterventionPayload = z.output<typeof startInterventionSchema>;

export const timerActionSchema = z.enum(["pause", "resume", "end"]);
export type TimerAction = z.infer<typeof timerActionSchema>;

/** Étape 4 : réévaluation (score final obligatoire) et notes facultatives. */
export const completeCravingSchema = z.object({
  finalCravingScore: cravingScoreSchema,
  helpedText: optionalText(CRAVING_TEXT_LIMITS.helpedText),
  outcomeText: optionalText(CRAVING_TEXT_LIMITS.outcomeText),
});

export type CompleteCravingPayload = z.output<typeof completeCravingSchema>;
