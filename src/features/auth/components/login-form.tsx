"use client";

import { useActionState } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { FormField, getFieldControlProps } from "@/components/forms/form-field";
import { PasswordInput } from "@/components/forms/password-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { routes } from "@/config/routes";
import { signInAction, type LoginField, type LoginState } from "@/features/auth/actions";
import { TextLink } from "@/features/auth/components/text-link";
import { loginSchema } from "@/features/auth/schemas";
import { useClientValidation } from "@/hooks/use-client-validation";
import { idleFormState } from "@/lib/forms";

const initialState: LoginState = idleFormState;

type LoginFormProps = {
  /** Destination interne déjà validée côté serveur. */
  next?: string;
  /** Message provenant de l'URL (ex. lien expiré). */
  notice?: string | null;
};

export function LoginForm({ next, notice }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(signInAction, initialState);
  const { clientErrors, onSubmit } = useClientValidation<LoginField>(loginSchema);
  const errors = clientErrors ?? state.fieldErrors ?? {};
  const globalError = state.status === "error" ? state.message : notice;

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="grid gap-5">
      {globalError ? <FormAlert tone="error" message={globalError} /> : null}

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

      <FormField
        id="password"
        label="Mot de passe"
        error={errors.password}
        labelAction={
          <TextLink href={routes.forgotPassword} className="text-sm">
            Mot de passe oublié?
          </TextLink>
        }
      >
        <PasswordInput
          {...getFieldControlProps("password", { error: errors.password })}
          name="password"
          autoComplete="current-password"
          required
        />
      </FormField>

      {next ? <input type="hidden" name="next" value={next} /> : null}

      <SubmitButton pending={pending} pendingLabel="Connexion…" className="w-full">
        Se connecter
      </SubmitButton>

      <p className="text-center text-sm text-muted-foreground">
        Pas encore de compte? <TextLink href={routes.signup}>Créer un compte</TextLink>
      </p>
    </form>
  );
}
