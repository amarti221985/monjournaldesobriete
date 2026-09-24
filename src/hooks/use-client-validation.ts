"use client";

import { useState, type FormEvent } from "react";
import type { z } from "zod";

import { getFieldErrors, type FieldErrors } from "@/lib/forms";

/**
 * Validation côté client avec le même schéma Zod que la Server Action.
 * Si la saisie est invalide, la soumission est bloquée (aucun aller-retour serveur)
 * et le focus est placé sur le premier champ en erreur.
 * La validation serveur reste la référence : ceci n'améliore que l'expérience.
 */
export function useClientValidation<Field extends string>(schema: z.ZodType) {
  const [clientErrors, setClientErrors] = useState<FieldErrors<Field> | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const result = schema.safeParse(Object.fromEntries(new FormData(form)));

    if (result.success) {
      setClientErrors(null);
      return;
    }

    event.preventDefault();
    const errors = getFieldErrors<Field>(result.error);
    setClientErrors(errors);

    const firstField = Object.keys(errors)[0];
    const control = firstField ? form.elements.namedItem(firstField) : null;
    if (control instanceof HTMLElement) control.focus();
  }

  return { clientErrors, onSubmit };
}
