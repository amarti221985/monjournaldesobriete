"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { FormField, getFieldControlProps } from "@/components/forms/form-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { routes } from "@/config/routes";
import {
  requestPasswordResetAction,
  type ForgotPasswordField,
  type ForgotPasswordState,
} from "@/features/auth/actions";
import { TextLink } from "@/features/auth/components/text-link";
import { forgotPasswordSchema } from "@/features/auth/schemas";
import { useClientValidation } from "@/hooks/use-client-validation";
import { idleFormState } from "@/lib/forms";

const initialState: ForgotPasswordState = idleFormState;

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialState);
  const { clientErrors, onSubmit } = useClientValidation<ForgotPasswordField>(forgotPasswordSchema);

  if (state.status === "success" && state.message) {
    return (
      <div className="grid gap-5">
        <FormAlert tone="success" message={state.message} />
        <Button asChild size="lg" variant="outline" className="w-full">
          <Link href={routes.login}>Retour à la connexion</Link>
        </Button>
      </div>
    );
  }

  const errors = clientErrors ?? state.fieldErrors ?? {};

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="grid gap-5">
      {state.status === "error" && state.message ? (
        <FormAlert tone="error" message={state.message} />
      ) : null}

      <FormField id="email" label="Courriel" error={errors.email}>
        <Input
          {...getFieldControlProps("email", { error: errors.email })}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={state.values?.email}
        />
      </FormField>

      <SubmitButton pending={pending} pendingLabel="Envoi…" className="w-full">
        Envoyer le lien
      </SubmitButton>

      <p className="text-center text-sm text-muted-foreground">
        <TextLink href={routes.login}>Retour à la connexion</TextLink>
      </p>
    </form>
  );
}
