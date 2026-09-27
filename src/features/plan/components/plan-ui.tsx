"use client";

import { Check, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";

import { FormField, getFieldControlProps } from "@/components/forms/form-field";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAchievementNotifier } from "@/features/achievements/components/achievement-notifier";
import { PLAN_SAVED } from "@/features/plan/constants";
import type { PlanActionState } from "@/features/plan/actions";
import { cn } from "@/lib/utils";

/*
 * Briques communes des sections de « Mon plan » : consultation d'abord, édition
 * dans la carte, sauvegarde indépendante par section, aucune perte silencieuse.
 */

type PlanSectionProps = {
  id: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function PlanSection({ id, title, description, action, children }: PlanSectionProps) {
  return (
    <Card id={id} className="scroll-mt-24">
      <CardHeader className="gap-2 sm:grid-cols-[1fr_auto]">
        <div className="grid gap-1">
          <CardTitle>
            <h2 className="text-base font-semibold">{title}</h2>
          </CardTitle>
          {description ? <CardDescription className="text-pretty">{description}</CardDescription> : null}
        </div>
        {action ? <div className="sm:self-start">{action}</div> : null}
      </CardHeader>
      <CardContent className="grid gap-4">{children}</CardContent>
    </Card>
  );
}

/** Exécute une Server Action, affiche l'erreur (données conservées) ou « Modifications enregistrées ». */
export function usePlanAction() {
  const router = useRouter();
  const notifyAchievements = useAchievementNotifier();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function run(action: () => Promise<PlanActionState>, onSuccess?: () => void) {
    setSaved(false);
    startTransition(async () => {
      const result = await action();
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      setError(null);
      setSaved(true);
      notifyAchievements(result.achievements);
      onSuccess?.();
      router.refresh();
    });
  }

  return { isPending, error, saved, run, clearError: () => setError(null), clearSaved: () => setSaved(false) };
}

/** Avertit avant de quitter la page si des modifications ne sont pas enregistrées. */
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);
}

export function StatusLine({ error, saved }: { error: string | null; saved: boolean }) {
  return (
    <>
      {error ? (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <p aria-live="polite" className={cn("flex items-center gap-1.5 text-sm text-muted-foreground", !saved && "sr-only")}>
        {saved ? (
          <>
            <Check className="size-4 text-primary" aria-hidden="true" />
            {PLAN_SAVED}
          </>
        ) : null}
      </p>
    </>
  );
}

/**
 * Boutons Enregistrer / Annuler. Annuler avec des modifications en cours demande
 * confirmation (aucune perte silencieuse).
 */
export function FormActions({
  pending,
  dirty,
  onCancel,
  submitLabel = "Enregistrer",
  retry = false,
}: {
  pending: boolean;
  dirty: boolean;
  onCancel: () => void;
  submitLabel?: string;
  retry?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : retry ? "Réessayer" : submitLabel}
      </Button>
      <Button type="button" variant="outline" disabled={pending} onClick={() => (dirty ? setConfirming(true) : onCancel())}>
        Annuler
      </Button>
      <ConfirmDialog
        open={confirming}
        title="Abandonner les modifications ?"
        description="Les changements que tu viens de faire ne seront pas enregistrés."
        confirmLabel="Abandonner"
        cancelLabel="Continuer à modifier"
        onConfirm={() => {
          setConfirming(false);
          onCancel();
        }}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}

export function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="outline" size="sm" className="min-h-9" onClick={onClick}>
      <Pencil data-icon="inline-start" aria-hidden="true" />
      {label}
    </Button>
  );
}

export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="outline" size="sm" className="min-h-9" onClick={onClick}>
      <Plus data-icon="inline-start" aria-hidden="true" />
      {label}
    </Button>
  );
}

/** Favori : bouton bascule (aria-pressed), étoile pleine + texte, jamais la couleur seule. */
export function FavoriteButton({
  active,
  label,
  disabled,
  onToggle,
}: {
  active: boolean;
  label: string;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-pressed={active}
      aria-label={`${active ? "Retirer des favoris" : "Ajouter aux favoris"} : ${label}`}
      disabled={disabled}
      onClick={onToggle}
      className="min-h-9"
    >
      <Star className={cn("size-4", active && "fill-current text-primary")} aria-hidden="true" />
      <span className="text-xs">{active ? "Favori" : "Favori ?"}</span>
    </Button>
  );
}

/** Suppression ou arrêt, toujours après confirmation. */
export function ConfirmedActionButton({
  label,
  accessibleLabel,
  title,
  description,
  confirmLabel,
  pending,
  onConfirm,
  icon = true,
}: {
  label: string;
  accessibleLabel?: string;
  title: string;
  description: string;
  confirmLabel: string;
  pending: boolean;
  onConfirm: () => void;
  icon?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="ghost" size="sm" className="min-h-9" aria-label={accessibleLabel} onClick={() => setOpen(true)}>
        {icon ? <Trash2 data-icon="inline-start" aria-hidden="true" /> : null}
        {label}
      </Button>
      <ConfirmDialog
        open={open}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        pending={pending}
        onConfirm={() => {
          setOpen(false);
          onConfirm();
        }}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

export function TextField({
  id,
  label,
  value,
  onChange,
  max,
  hint,
  error,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  max: number;
  hint?: string;
  error?: string;
  placeholder?: string;
}) {
  return (
    <FormField id={id} label={label} hint={hint} error={error}>
      <Input
        {...getFieldControlProps(id, { hint, error })}
        value={value}
        maxLength={max}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
      />
    </FormField>
  );
}

export function TextAreaField({
  id,
  label,
  value,
  onChange,
  max,
  hint,
  error,
  placeholder,
  rows = 3,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  max: number;
  hint?: string;
  error?: string;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <FormField id={id} label={label} hint={hint} error={error}>
      <Textarea
        {...getFieldControlProps(id, { hint, error })}
        value={value}
        maxLength={max}
        rows={rows}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-24 bg-card px-3.5 py-3 field-sizing-content"
      />
    </FormField>
  );
}

/** Groupe de choix radio compact (objectif, durée). */
export function ChoiceGroup<T extends string | number | null>({
  name,
  legend,
  options,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={String(option.value)}
            className={cn(
              "inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border bg-card px-3.5 text-sm font-medium transition-colors",
              "hover:border-primary/50 has-[:checked]:border-primary has-[:checked]:bg-secondary has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
            )}
          >
            <input
              type="radio"
              name={name}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <Check aria-hidden="true" strokeWidth={3} className={cn("-ml-1 size-3.5", value !== option.value && "hidden")} />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function EmptyState({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="grid gap-3 rounded-xl border border-dashed p-4">
      <p className="text-sm text-pretty text-muted-foreground">{text}</p>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function SectionUnavailable() {
  return <p className="text-sm text-muted-foreground">Cette section n&apos;a pas pu être chargée. Recharge la page dans quelques instants.</p>;
}
