"use client";

import { Eye } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { revealAccountEmailAction, setFeedbackStatusAction } from "@/features/admin/actions";
import { FEEDBACK_STATUSES, feedbackStatusLabels, type FeedbackStatus } from "@/features/admin/analytics/definitions";

/** Statut de traitement d'un avis (seule modification possible pour l'admin). */
export function FeedbackStatusControl({ id, status }: { id: string; status: FeedbackStatus }) {
  const [value, setValue] = useState(status);
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Statut</span>
      <select
        value={value}
        disabled={isPending}
        onChange={(event) => {
          const next = event.target.value as FeedbackStatus;
          const previous = value;
          setValue(next);
          setFailed(false);
          startTransition(async () => {
            const result = await setFeedbackStatusAction({ id, status: next }).catch(() => ({ ok: false }));
            if (!result.ok) {
              setValue(previous);
              setFailed(true);
            }
          });
        }}
        className="h-10 rounded-lg border bg-card px-2 text-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {FEEDBACK_STATUSES.map((option) => (
          <option key={option} value={option}>
            {feedbackStatusLabels[option]}
          </option>
        ))}
      </select>
      {failed ? (
        <span role="alert" className="text-xs text-destructive">
          Non enregistré
        </span>
      ) : null}
    </label>
  );
}

/**
 * Courriel d'un compte, pour le support uniquement : jamais affiché par défaut ; révélé sur
 * action volontaire, journalisée côté base.
 */
export function RevealAccountEmail({ code }: { code: string }) {
  const [email, setEmail] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "unavailable">("idle");
  const [isPending, startTransition] = useTransition();
  if (email) {
    return (
      <p className="text-sm">
        Courriel : <span className="font-medium break-all">{email}</span>
      </p>
    );
  }
  return (
    <div className="grid gap-2">
      <p className="text-sm text-pretty text-muted-foreground">
        Pour le support seulement. Le courriel n&apos;est jamais affiché par défaut ; cette consultation est enregistrée dans le journal d&apos;audit.
      </p>
      <Button
        type="button"
        variant="outline"
        className="justify-self-start"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await revealAccountEmailAction(code).catch(() => ({ email: null }));
            if (result.email) setEmail(result.email);
            else setState("unavailable");
          })
        }
      >
        <Eye data-icon="inline-start" aria-hidden="true" />
        Afficher les informations de compte
      </Button>
      {state === "unavailable" ? (
        <p role="alert" className="text-sm text-muted-foreground">
          Informations indisponibles.
        </p>
      ) : null}
    </div>
  );
}
