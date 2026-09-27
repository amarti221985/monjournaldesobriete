"use client";

import { Download, LogOut, MonitorSmartphone } from "lucide-react";
import { useActionState, useState, useTransition } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { FormField, getFieldControlProps } from "@/components/forms/form-field";
import { PasswordInput } from "@/components/forms/password-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { routes } from "@/config/routes";
import { signOutAction } from "@/features/auth/actions";
import { PASSWORD_MIN } from "@/features/auth/schemas";
import {
  changePasswordAction,
  requestEmailChangeAction,
  signOutOtherSessionsAction,
  updateDisplayNameAction,
  updateTimezoneAction,
  type SettingsActionState,
} from "@/features/settings/actions";

const IDLE: SettingsActionState = { status: "idle" };

function Feedback({ state }: { state: SettingsActionState }) {
  if (state.status === "idle") return null;
  return <FormAlert tone={state.status === "error" ? "error" : "success"} message={state.message} />;
}

function fieldError(state: SettingsActionState, field: string) {
  return state.status === "error" && state.field === field ? state.message : undefined;
}

// --- Mon compte ------------------------------------------------------------------------

export function DisplayNameForm({ displayName }: { displayName: string }) {
  const [state, action, pending] = useActionState(updateDisplayNameAction, IDLE);
  return (
    <form action={action} className="grid gap-3">
      <FormField id="displayName" label="Nom affiché" error={fieldError(state, "displayName")}>
        <Input
          {...getFieldControlProps("displayName", { error: fieldError(state, "displayName") })}
          name="displayName"
          defaultValue={displayName}
          maxLength={80}
          autoComplete="nickname"
          required
        />
      </FormField>
      <Feedback state={state.status === "error" && state.field ? IDLE : state} />
      <SubmitButton pending={pending} pendingLabel="Enregistrement…" className="justify-self-start">
        Enregistrer
      </SubmitButton>
    </form>
  );
}

export function TimezoneForm({ timezone, options }: { timezone: string; options: string[] }) {
  const [state, action, pending] = useActionState(updateTimezoneAction, IDLE);
  const hint =
    "La timezone est utilisée pour déterminer tes journées, tes semaines et les dates affichées dans l'application. Tes journées déjà enregistrées ne changent pas.";
  return (
    <form action={action} className="grid gap-3">
      <FormField id="timezone" label="Fuseau horaire" hint={hint} error={fieldError(state, "timezone")}>
        <select
          {...getFieldControlProps("timezone", { hint, error: fieldError(state, "timezone") })}
          name="timezone"
          defaultValue={timezone}
          className="h-11 w-full rounded-lg border bg-card px-3 text-sm sm:max-w-sm"
        >
          {options.map((zone) => (
            <option key={zone} value={zone}>
              {zone.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </FormField>
      <Feedback state={state.status === "error" && state.field ? IDLE : state} />
      <SubmitButton pending={pending} pendingLabel="Enregistrement…" className="justify-self-start">
        Enregistrer
      </SubmitButton>
    </form>
  );
}

// --- Sécurité -------------------------------------------------------------------------

export function EmailChangeForm({ email, pendingEmail }: { email: string | null; pendingEmail: string | null }) {
  const [state, action, pending] = useActionState(requestEmailChangeAction, IDLE);
  return (
    <form action={action} className="grid gap-3">
      <p className="text-sm">
        Adresse actuelle : <span className="font-medium">{email ?? "—"}</span>
      </p>
      {pendingEmail ? (
        <p className="text-sm text-muted-foreground">Changement en attente de confirmation vers {pendingEmail}.</p>
      ) : null}
      <FormField id="newEmail" label="Nouvelle adresse courriel" error={fieldError(state, "email")}>
        <Input
          {...getFieldControlProps("newEmail", { error: fieldError(state, "email") })}
          name="email"
          type="email"
          maxLength={254}
          autoComplete="email"
          required
        />
      </FormField>
      <Feedback state={state.status === "error" && state.field ? IDLE : state} />
      <SubmitButton pending={pending} pendingLabel="Envoi…" className="justify-self-start">
        Modifier mon adresse courriel
      </SubmitButton>
    </form>
  );
}

export function PasswordChangeForm() {
  const [state, action, pending] = useActionState(changePasswordAction, IDLE);
  const hint = `Au moins ${PASSWORD_MIN} caractères.`;
  return (
    <form action={action} className="grid gap-3" key={state.status === "success" ? "done" : "form"}>
      <FormField id="currentPassword" label="Mot de passe actuel" error={fieldError(state, "currentPassword")}>
        <PasswordInput
          {...getFieldControlProps("currentPassword", { error: fieldError(state, "currentPassword") })}
          name="currentPassword"
          autoComplete="current-password"
          required
        />
      </FormField>
      <FormField id="newPassword" label="Nouveau mot de passe" hint={hint} error={fieldError(state, "password")}>
        <PasswordInput
          {...getFieldControlProps("newPassword", { hint, error: fieldError(state, "password") })}
          name="password"
          autoComplete="new-password"
          required
        />
      </FormField>
      <FormField id="newPasswordConfirmation" label="Confirmer le nouveau mot de passe" error={fieldError(state, "passwordConfirmation")}>
        <PasswordInput
          {...getFieldControlProps("newPasswordConfirmation", { error: fieldError(state, "passwordConfirmation") })}
          name="passwordConfirmation"
          autoComplete="new-password"
          required
        />
      </FormField>
      <Feedback state={state.status === "error" && state.field ? IDLE : state} />
      <SubmitButton pending={pending} pendingLabel="Mise à jour…" className="justify-self-start">
        Modifier mon mot de passe
      </SubmitButton>
    </form>
  );
}

export function SessionControls() {
  const [state, setState] = useState<SettingsActionState>(IDLE);
  const [isPending, startTransition] = useTransition();
  const [isSigningOut, startSignOut] = useTransition();
  return (
    <div className="grid gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" variant="outline" disabled={isSigningOut} onClick={() => startSignOut(() => signOutAction())}>
          <LogOut data-icon="inline-start" aria-hidden="true" />
          {isSigningOut ? "Déconnexion…" : "Se déconnecter"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={isPending}
          onClick={() => startTransition(async () => setState(await signOutOtherSessionsAction()))}
        >
          <MonitorSmartphone data-icon="inline-start" aria-hidden="true" />
          {isPending ? "Déconnexion…" : "Se déconnecter des autres appareils"}
        </Button>
      </div>
      <Feedback state={state} />
    </div>
  );
}

// --- Mes données ----------------------------------------------------------------------

/** Télécharge l'export JSON (POST même origine) ; bouton désactivé pendant la préparation. */
export function ExportButton({ variant = "default" }: { variant?: "default" | "outline" }) {
  const [status, setStatus] = useState<"idle" | "pending" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function download() {
    if (status === "pending") return;
    setStatus("pending");
    setMessage(null);
    try {
      const response = await fetch(routes.accountExport, { method: "POST", cache: "no-store" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "L'export n'a pas pu être préparé.");
      }
      const disposition = response.headers.get("content-disposition") ?? "";
      const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "mes-donnees.json";
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setStatus("done");
      setMessage("Ton export a été téléchargé.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "L'export n'a pas pu être préparé.");
    }
  }

  return (
    <div className="grid gap-3">
      <Button type="button" variant={variant} onClick={download} disabled={status === "pending"} className="justify-self-start">
        <Download data-icon="inline-start" aria-hidden="true" />
        {status === "pending" ? "Préparation…" : "Exporter mes données"}
      </Button>
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {message}
      </p>
    </div>
  );
}
