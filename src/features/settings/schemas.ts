import { z } from "zod";

import { displayNameSchema, emailSchema, newPasswordSchema, PASSWORD_MAX } from "@/features/auth/schemas";
import { isValidTimeZone } from "@/lib/timezone";

/**
 * Paramètres du compte (Sprint 11). Les objets Zod ne conservent QUE les champs
 * déclarés : tout champ supplémentaire (user_id, created_at, role…) est ignoré
 * (pas d'affectation de masse). L'identité vient toujours de la session.
 */

export const DELETE_CONFIRMATION_WORD = "SUPPRIMER";

export const displayNameUpdateSchema = z.object({ displayName: displayNameSchema });

export const timezoneUpdateSchema = z.object({
  timezone: z.string().refine(isValidTimeZone, "Choisis un fuseau horaire valide."),
});

export const emailChangeSchema = z.object({ email: emailSchema });

const currentPasswordSchema = z
  .string({ error: "Indique ton mot de passe actuel." })
  .min(1, "Indique ton mot de passe actuel.")
  .max(PASSWORD_MAX, "Mot de passe invalide.");

export const passwordChangeSchema = z
  .object({
    currentPassword: currentPasswordSchema,
    password: newPasswordSchema,
    passwordConfirmation: z.string(),
  })
  .refine((value) => value.password === value.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "Les deux mots de passe ne correspondent pas.",
  })
  .refine((value) => value.password !== value.currentPassword, {
    path: ["password"],
    message: "Choisis un mot de passe différent de l'actuel.",
  });

/** Suppression du compte : mot « SUPPRIMER » exact + mot de passe (réauthentification). */
export const deleteAccountSchema = z.object({
  confirmation: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value === DELETE_CONFIRMATION_WORD, `Écris ${DELETE_CONFIRMATION_WORD} pour confirmer.`),
  password: currentPasswordSchema,
});
