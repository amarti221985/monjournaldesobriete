import type { z } from "zod";

/**
 * État commun des formulaires basés sur des Server Actions (useActionState).
 * idle → (pending, géré par React) → success | error
 */
export type FormStatus = "idle" | "success" | "error";

export type FieldErrors<Field extends string> = Partial<Record<Field, string>>;

export type FormState<Field extends string> = {
  status: FormStatus;
  /** Message global (succès ou erreur), affiché dans une zone annoncée aux lecteurs d'écran. */
  message?: string;
  fieldErrors?: FieldErrors<Field>;
  /** Valeurs non sensibles à réafficher après une erreur (jamais de mot de passe). */
  values?: Partial<Record<Field, string>>;
};

export const idleFormState = { status: "idle" } as const satisfies FormState<never>;

/** Premier message d'erreur par champ, à partir d'une erreur Zod. */
export function getFieldErrors<Field extends string>(error: z.ZodError): FieldErrors<Field> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !(field in fieldErrors)) {
      fieldErrors[field] = issue.message;
    }
  }
  return fieldErrors as FieldErrors<Field>;
}

/** Lit des champs texte d'un FormData (les fichiers et champs absents sont ignorés). */
export function readFormFields<Field extends string>(
  formData: FormData,
  fields: readonly Field[],
): Partial<Record<Field, string>> {
  const values: Partial<Record<Field, string>> = {};
  for (const field of fields) {
    const value = formData.get(field);
    if (typeof value === "string") values[field] = value;
  }
  return values;
}
