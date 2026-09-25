import { z } from "zod";

import {
  MAX_TRACKED_SUBSTANCES,
  MOTIVATIONS,
  OTHER_SUBSTANCE_SLUG,
  SUBSTANCE_GOALS,
} from "@/features/onboarding/constants";
import { isAfterDate, isValidDateString, MIN_JOURNEY_DATE } from "@/lib/dates";

/**
 * Schémas de l'onboarding, partagés client / serveur.
 * La base revalide tout dans public.complete_onboarding() (défense en profondeur).
 */

const CONTROL_CHARACTERS = /\p{Cc}/u;
const PHONE_FORMAT = /^[0-9+(). -]{3,32}$/;

/** Texte facultatif : espaces retirés, chaîne vide → undefined. */
function optionalText(max: number, tooLong: string) {
  return z
    .string()
    .optional()
    .transform((value) => value?.replace(/\s+/g, " ").trim() || undefined)
    .pipe(z.string().max(max, tooLong).optional());
}

export const substanceSlugSchema = z
  .string({ error: "Choix invalide." })
  .regex(/^[a-z][a-z0-9_]{1,39}$/, "Choix invalide.");

export const substanceGoalSchema = z.enum(SUBSTANCE_GOALS, {
  error: "Choisis un objectif.",
});

export const motivationSchema = z.enum(MOTIVATIONS, { error: "Choix invalide." });

export const customNameSchema = optionalText(80, "80 caractères maximum.");

export const selectedSubstanceSchema = z.object({
  slug: substanceSlugSchema,
  customName: customNameSchema,
});

function hasUniqueSlugs(items: readonly { slug: string }[]) {
  return new Set(items.map((item) => item.slug)).size === items.length;
}

export const substanceSelectionSchema = z
  .array(selectedSubstanceSchema)
  .min(1, "Choisis au moins une option.")
  .max(MAX_TRACKED_SUBSTANCES, `${MAX_TRACKED_SUBSTANCES} choix maximum.`)
  .refine(hasUniqueSlugs, "Chaque option ne peut être choisie qu'une fois.");

export const trackedSubstanceSchema = selectedSubstanceSchema.extend({
  goal: substanceGoalSchema,
});

/** Date de début : vraie date, pas avant 1900, jamais après `latestAllowedDate`. */
export function createStartDateSchema(latestAllowedDate: string) {
  return z
    .string({ error: "Choisis une date." })
    .min(1, "Choisis une date.")
    .refine(isValidDateString, "Choisis une date valide.")
    .refine((date) => date >= MIN_JOURNEY_DATE, "Choisis une date valide.")
    .refine(
      (date) => !isAfterDate(date, latestAllowedDate),
      "La date de début ne peut pas être dans le futur.",
    );
}

export const REASON_MAX = 2000;

export const reasonSchema = z
  .string({ error: "Écris quelques mots sur ce qui compte pour toi." })
  .trim()
  .min(1, "Écris quelques mots sur ce qui compte pour toi.")
  .max(REASON_MAX, `${REASON_MAX} caractères maximum.`);

export const motivationsSchema = z
  .array(motivationSchema)
  .min(1, "Choisis au moins un élément.")
  .max(MOTIVATIONS.length)
  .refine((items) => new Set(items).size === items.length, "Choix en double.");

export const motivationOtherSchema = optionalText(80, "80 caractères maximum.");

export const supportContactSchema = z.object({
  name: z
    .string({ error: "Indique un nom ou un prénom." })
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(
      z
        .string()
        .min(1, "Indique un nom ou un prénom.")
        .max(80, "80 caractères maximum.")
        .refine((value) => !CONTROL_CHARACTERS.test(value), "Ce nom contient des caractères invalides."),
    ),
  relationship: optionalText(60, "60 caractères maximum."),
  phone: optionalText(32, "Ce numéro ne semble pas valide.").refine(
    (value) => value === undefined || PHONE_FORMAT.test(value),
    "Ce numéro ne semble pas valide.",
  ),
  email: z
    .string()
    .optional()
    .transform((value) => value?.trim().toLowerCase() || undefined)
    .pipe(
      z
        .email("Cette adresse courriel ne semble pas valide.")
        .max(254, "Cette adresse courriel est trop longue.")
        .optional(),
    ),
});

export type SupportContactInput = z.input<typeof supportContactSchema>;

/** Données complètes exigées pour finaliser l'onboarding. */
export function createOnboardingCompletionSchema(latestAllowedDate: string) {
  return z
    .object({
      substances: z
        .array(trackedSubstanceSchema)
        .min(1, "Choisis au moins une option.")
        .max(MAX_TRACKED_SUBSTANCES),
      primarySlug: substanceSlugSchema,
      startedOn: createStartDateSchema(latestAllowedDate),
      reason: reasonSchema,
      motivations: motivationsSchema,
      motivationOther: motivationOtherSchema,
      supportContact: supportContactSchema.nullable(),
    })
    .superRefine((data, context) => {
      if (!hasUniqueSlugs(data.substances)) {
        context.addIssue({ code: "custom", path: ["substances"], message: "Choix en double." });
      }
      if (!data.substances.some((substance) => substance.slug === data.primarySlug)) {
        context.addIssue({
          code: "custom",
          path: ["primarySlug"],
          message: "Choisis ce que tu souhaites principalement changer.",
        });
      }
      data.substances.forEach((substance, index) => {
        if (substance.customName && substance.slug !== OTHER_SUBSTANCE_SLUG) {
          context.addIssue({ code: "custom", path: ["substances", index, "customName"], message: "Choix invalide." });
        }
      });
    });
}

export type OnboardingCompletionPayload = z.output<ReturnType<typeof createOnboardingCompletionSchema>>;

/**
 * Brouillon du wizard : réponses partielles, bornées en taille.
 * Stocké côté serveur (onboarding_drafts, RLS), jamais dans le navigateur.
 */
const draftText = (max: number) => z.string().max(max).optional();

export const onboardingDraftSchema = z.object({
  substances: z
    .array(
      z.object({
        slug: substanceSlugSchema,
        customName: draftText(80),
        goal: substanceGoalSchema.optional(),
      }),
    )
    .max(MAX_TRACKED_SUBSTANCES)
    .optional(),
  primarySlug: substanceSlugSchema.optional(),
  startedOn: draftText(10),
  reason: draftText(REASON_MAX),
  motivations: z.array(motivationSchema).max(MOTIVATIONS.length).optional(),
  motivationOther: draftText(80),
  supportContact: z
    .object({
      name: draftText(80),
      relationship: draftText(60),
      phone: draftText(32),
      email: draftText(254),
    })
    .nullable()
    .optional(),
});

export type OnboardingDraft = z.infer<typeof onboardingDraftSchema>;

export const draftStepSchema = z.number().int().min(1).max(8);
