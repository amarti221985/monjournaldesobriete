import { z } from "zod";

import { isValidTimeZone } from "@/lib/timezone";

/**
 * Schémas de validation de l'authentification, partagés client / serveur.
 * Messages en français, affichés près du champ concerné.
 */

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 80;
export const PASSWORD_MIN = 8;
// Supabase Auth (bcrypt) ne prend en compte que 72 octets.
export const PASSWORD_MAX = 72;
const EMAIL_MAX = 254;

// Caractères de contrôle (retours à la ligne, tabulations, etc.).
const CONTROL_CHARACTERS = /\p{Cc}/u;

export const displayNameSchema = z
  .string({ error: "Indique ton prénom ou un nom d'affichage." })
  .transform((value) => value.replace(/\s+/g, " ").trim())
  .pipe(
    z
      .string()
      .min(1, "Indique ton prénom ou un nom d'affichage.")
      .min(DISPLAY_NAME_MIN, `Au moins ${DISPLAY_NAME_MIN} caractères.`)
      .max(DISPLAY_NAME_MAX, `${DISPLAY_NAME_MAX} caractères maximum.`)
      .refine((value) => !CONTROL_CHARACTERS.test(value), "Ce nom contient des caractères invalides."),
  );

export const emailSchema = z
  .string({ error: "Indique ton adresse courriel." })
  .trim()
  .toLowerCase()
  .pipe(
    z
      .string()
      .min(1, "Indique ton adresse courriel.")
      .max(EMAIL_MAX, "Cette adresse courriel est trop longue.")
      .pipe(z.email("Cette adresse courriel ne semble pas valide.")),
  );

/** Nouveau mot de passe (inscription, réinitialisation). Jamais modifié (pas de trim). */
export const newPasswordSchema = z
  .string({ error: "Choisis un mot de passe." })
  .min(1, "Choisis un mot de passe.")
  .min(PASSWORD_MIN, `Au moins ${PASSWORD_MIN} caractères.`)
  .max(PASSWORD_MAX, `${PASSWORD_MAX} caractères maximum.`);

const passwordConfirmationSchema = z.string({ error: "Confirme ton mot de passe." });

const optionalTimeZoneSchema = z
  .string()
  .optional()
  .transform((value) => (isValidTimeZone(value) ? value : undefined));

function passwordsMatch(data: { password: string; passwordConfirmation: string }) {
  return data.password === data.passwordConfirmation;
}

const passwordMismatch = {
  message: "Les deux mots de passe ne correspondent pas.",
  path: ["passwordConfirmation"],
};

export const signupSchema = z
  .object({
    displayName: displayNameSchema,
    email: emailSchema,
    password: newPasswordSchema,
    passwordConfirmation: passwordConfirmationSchema,
    timezone: optionalTimeZoneSchema,
  })
  .refine(passwordsMatch, passwordMismatch);

export const loginSchema = z.object({
  email: emailSchema,
  // À la connexion, on ne réapplique pas les règles de création du mot de passe.
  password: z
    .string({ error: "Indique ton mot de passe." })
    .min(1, "Indique ton mot de passe.")
    .max(PASSWORD_MAX, "Impossible de se connecter avec ces informations."),
  next: z.string().optional(),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    password: newPasswordSchema,
    passwordConfirmation: passwordConfirmationSchema,
  })
  .refine(passwordsMatch, passwordMismatch);

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
