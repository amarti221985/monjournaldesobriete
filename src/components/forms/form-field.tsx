import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FormFieldProps = {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  /** Élément affiché à droite du libellé (ex. lien « Mot de passe oublié? »). */
  labelAction?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function getFieldHintId(id: string) {
  return `${id}-hint`;
}

export function getFieldErrorId(id: string) {
  return `${id}-error`;
}

/**
 * Attributs d'accessibilité à appliquer au contrôle d'un FormField :
 * lien vers l'aide et l'erreur, état invalide.
 */
export function getFieldControlProps(id: string, { error, hint }: { error?: string; hint?: string }) {
  const describedBy = [hint ? getFieldHintId(id) : null, error ? getFieldErrorId(id) : null]
    .filter(Boolean)
    .join(" ");

  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy || undefined,
  } as const;
}

/** Libellé + contrôle + aide + erreur, reliés pour les technologies d'assistance. */
export function FormField({
  id,
  label,
  error,
  hint,
  labelAction,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {labelAction}
      </div>
      {children}
      {hint ? (
        <p id={getFieldHintId(id)} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={getFieldErrorId(id)} className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
