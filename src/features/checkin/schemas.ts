import { z } from "zod";

import {
  CHECKIN_STATUSES,
  MAX_CONSUMPTION_EVENTS,
  MAX_QUANTITY,
  MAX_SELECTIONS,
  OTHER_SLUG,
  TEXT_LIMITS,
} from "@/features/checkin/constants";
import { isAfterDate, isValidDateString, MIN_JOURNEY_DATE } from "@/lib/dates";

/**
 * Schémas du check-in, partagés client / serveur. La RPC public.save_checkin()
 * et les contraintes de la base revalident tout (défense en profondeur).
 */

export const checkinStatusSchema = z.enum(CHECKIN_STATUSES, {
  error: "Choisis comment s'est passée ta journée.",
});

function score(min: number, max: number) {
  return z
    .number({ error: "Choisis une valeur." })
    .int("Choisis une valeur.")
    .min(min, `Entre ${min} et ${max}.`)
    .max(max, `Entre ${min} et ${max}.`);
}

export const moodScoreSchema = score(1, 10);
export const energyScoreSchema = score(1, 10);
export const stressScoreSchema = score(1, 10);
export const cravingScoreSchema = score(0, 10);

/** Texte facultatif : espaces retirés, vide → undefined, longueur maximale. */
export function optionalText(max: number) {
  return z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined)
    .pipe(z.string().max(max, `${max} caractères maximum.`).optional());
}

const catalogueSlugSchema = z.string().regex(/^[a-z][a-z0-9_]{1,39}$/, "Choix invalide.");

function uniqueBy<T>(items: readonly T[], key: (item: T) => string) {
  return new Set(items.map(key)).size === items.length;
}

const labelledSelectionSchema = z
  .object({
    slug: catalogueSlugSchema,
    customLabel: optionalText(TEXT_LIMITS.customLabel),
  })
  // Une précision n'a de sens que pour « Autre ».
  .transform(({ slug, customLabel }) => ({
    slug,
    customLabel: slug === OTHER_SLUG ? customLabel : undefined,
  }));

const labelledSelectionsSchema = z
  .array(labelledSelectionSchema)
  .max(MAX_SELECTIONS)
  .refine((items) => uniqueBy(items, (item) => item.slug), "Choix en double.");

export const emotionsSchema = z
  .array(catalogueSlugSchema)
  .max(MAX_SELECTIONS)
  .refine((items) => uniqueBy(items, (item) => item), "Choix en double.");
export const triggersSchema = labelledSelectionsSchema;
export const achievementsSchema = labelledSelectionsSchema;

const TIME_FORMAT = /^([01]\d|2[0-3]):[0-5]\d$/;

export const consumptionEventSchema = z.object({
  userSubstanceId: z.uuid("Choisis ce que tu as consommé."),
  quantity: z
    .number()
    .positive("La quantité doit être positive.")
    .max(MAX_QUANTITY, "Quantité trop élevée.")
    .optional(),
  unit: optionalText(TEXT_LIMITS.unit),
  occurredAt: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined)
    .pipe(z.string().regex(TIME_FORMAT, "Choisis une heure valide.").optional()),
  cravingBefore: score(0, 10).optional(),
  contextText: optionalText(TEXT_LIMITS.eventText),
  reflectionText: optionalText(TEXT_LIMITS.eventText),
  nextTimeStrategyText: optionalText(TEXT_LIMITS.eventText),
});

export type ConsumptionEventPayload = z.output<typeof consumptionEventSchema>;

/**
 * Données envoyées à save_checkin().
 * `finalize` : check-in terminé (scores obligatoires et cohérence statut / consommations).
 * `latestAllowedDate` : aucune journée future.
 */
export function createCheckinPayloadSchema({
  latestAllowedDate,
  finalize,
}: {
  latestAllowedDate: string;
  finalize: boolean;
}) {
  const maybeRequired = <T extends z.ZodType>(schema: T) => (finalize ? schema : schema.optional());

  return z
    .object({
      checkinDate: z
        .string()
        .refine(isValidDateString, "Date invalide.")
        .refine((date) => date >= MIN_JOURNEY_DATE, "Date invalide.")
        .refine((date) => !isAfterDate(date, latestAllowedDate), "Un check-in ne peut pas être dans le futur."),
      status: checkinStatusSchema,
      moodScore: maybeRequired(moodScoreSchema),
      energyScore: maybeRequired(energyScoreSchema),
      stressScore: maybeRequired(stressScoreSchema),
      cravingScore: maybeRequired(cravingScoreSchema),
      emotions: emotionsSchema,
      triggers: triggersSchema,
      achievements: achievementsSchema,
      victoryText: optionalText(TEXT_LIMITS.victoryText),
      proudOfText: optionalText(TEXT_LIMITS.proudOfText),
      lessonText: optionalText(TEXT_LIMITS.lessonText),
      tomorrowIntentionText: optionalText(TEXT_LIMITS.tomorrowIntentionText),
      notes: optionalText(TEXT_LIMITS.notes),
      consumptionEvents: z.array(consumptionEventSchema).max(MAX_CONSUMPTION_EVENTS),
    })
    .superRefine((data, context) => {
      const hasEvents = data.consumptionEvents.length > 0;
      if (data.status !== "consumed" && hasEvents) {
        context.addIssue({
          code: "custom",
          path: ["consumptionEvents"],
          message: "Aucune consommation ne peut être associée à une journée sobre.",
        });
      }
      if (finalize && data.status === "consumed" && !hasEvents) {
        context.addIssue({
          code: "custom",
          path: ["consumptionEvents"],
          message: "Indique au moins ce que tu as consommé.",
        });
      }
    });
}

export type CheckinPayload = z.output<ReturnType<typeof createCheckinPayloadSchema>>;
