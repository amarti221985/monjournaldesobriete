"use client";

import { LogOut } from "lucide-react";
import { useActionState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";
import { signOutAction } from "@/features/auth/actions";

/** Bouton de déconnexion avec état d'attente. */
export function SignOutButton() {
  const [, formAction, pending] = useActionState(async () => {
    await signOutAction();
  }, undefined);

  return (
    <form action={formAction}>
      <SubmitButton pending={pending} pendingLabel="Déconnexion…" variant="outline">
        <LogOut data-icon="inline-start" aria-hidden="true" />
        Se déconnecter
      </SubmitButton>
    </form>
  );
}
