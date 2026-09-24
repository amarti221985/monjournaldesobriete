"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { FormField, getFieldControlProps } from "@/components/forms/form-field";
import { PasswordInput } from "@/components/forms/password-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import {
  updatePasswordAction,
  type ResetPasswordField,
  type ResetPasswordState,
} from "@/features/auth/actions";
import { PASSWORD_MIN, resetPasswordSchema } from "@/features/auth/schemas";
import { useClientValidation } from "@/hooks/use-client-validation";
import { getAuthenticatedHomeRoute } from "@/lib/auth/redirects";
import { idleFormState } from "@/lib/forms";

const initialState: ResetPasswordState = idleFormState;

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePasswordAction, initialState);
  const { clientErrors, onSubmit } = useClientValidation<ResetPasswordField>(resetPasswordSchema);

  if (state.status === "success" && state.message) {
    return (
      <div className="grid gap-5">
        <FormAlert tone="success" message={state.message} />
        <Button asChild size="lg" className="w-full">
          <Link href={getAuthenticatedHomeRoute()}>Accéder à mon espace</Link>
        </Button>
      </div>
    );
  }

  const errors = clientErrors ?? state.fieldErrors ?? {};
  const passwordHint = `Au moins ${PASSWORD_MIN} caractères.`;

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="grid gap-5">
      {state.status === "error" && state.message ? (
        <FormAlert tone="error" message={state.message} />
      ) : null}

      <FormField id="password" label="Nouveau mot de passe" error={errors.password} hint={passwordHint}>
        <PasswordInput
          {...getFieldControlProps("password", { error: errors.password, hint: passwordHint })}
          name="password"
          autoComplete="new-password"
          required
        />
      </FormField>

      <FormField
        id="passwordConfirmation"
        label="Confirmer le mot de passe"
        error={errors.passwordConfirmation}
      >
        <PasswordInput
          {...getFieldControlProps("passwordConfirmation", { error: errors.passwordConfirmation })}
          name="passwordConfirmation"
          autoComplete="new-password"
          required
        />
      </FormField>

      <SubmitButton pending={pending} pendingLabel="Mise à jour…" className="w-full">
        Mettre à jour mon mot de passe
      </SubmitButton>
    </form>
  );
}
