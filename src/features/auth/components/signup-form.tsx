"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useActionState, useSyncExternalStore } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { FormField, getFieldControlProps } from "@/components/forms/form-field";
import { PasswordInput } from "@/components/forms/password-input";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { routes } from "@/config/routes";
import { signUpAction, type SignupField, type SignupState } from "@/features/auth/actions";
import { TextLink } from "@/features/auth/components/text-link";
import { PASSWORD_MIN, signupSchema } from "@/features/auth/schemas";
import { useClientValidation } from "@/hooks/use-client-validation";
import { idleFormState } from "@/lib/forms";
import { detectBrowserTimeZone } from "@/lib/timezone";

const initialState: SignupState = idleFormState;

const subscribeToNothing = () => () => {};
const getBrowserTimeZone = () => detectBrowserTimeZone() ?? "";
const getServerTimeZone = () => "";

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signUpAction, initialState);
  const { clientErrors, onSubmit } = useClientValidation<SignupField>(signupSchema);
  // Fuseau du navigateur (indisponible côté serveur : chaîne vide au rendu initial).
  const timezone = useSyncExternalStore(subscribeToNothing, getBrowserTimeZone, getServerTimeZone);

  if (state.status === "success" && state.confirmationEmail) {
    return <CheckEmailMessage email={state.confirmationEmail} />;
  }

  const errors = clientErrors ?? state.fieldErrors ?? {};
  const passwordHint = `Au moins ${PASSWORD_MIN} caractères. Une phrase facile à retenir fonctionne bien.`;

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="grid gap-5">
      {state.status === "error" && state.message ? (
        <FormAlert tone="error" message={state.message} />
      ) : null}

      <FormField id="displayName" label="Prénom ou nom d'affichage" error={errors.displayName}>
        <Input
          {...getFieldControlProps("displayName", { error: errors.displayName })}
          name="displayName"
          autoComplete="name"
          maxLength={80}
          required
          defaultValue={state.values?.displayName}
        />
      </FormField>

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

      <FormField id="password" label="Mot de passe" error={errors.password} hint={passwordHint}>
        <PasswordInput
          {...getFieldControlProps("password", { error: errors.password, hint: passwordHint })}
          name="password"
          autoComplete="new-password"
          required
        />
      </FormField>

      <FormField
        id="passwordConfirmation"
        label="Confirmation du mot de passe"
        error={errors.passwordConfirmation}
      >
        <PasswordInput
          {...getFieldControlProps("passwordConfirmation", { error: errors.passwordConfirmation })}
          name="passwordConfirmation"
          autoComplete="new-password"
          required
        />
      </FormField>

      <input type="hidden" name="timezone" value={timezone} />

      <SubmitButton pending={pending} pendingLabel="Création du compte…" className="w-full">
        Créer mon compte
      </SubmitButton>

      <p className="text-center text-sm text-muted-foreground">
        Déjà un compte? <TextLink href={routes.login}>Se connecter</TextLink>
      </p>
    </form>
  );
}

function CheckEmailMessage({ email }: { email: string }) {
  return (
    <div role="status" className="grid gap-5">
      <div className="flex items-start gap-3 rounded-xl bg-secondary p-4 text-secondary-foreground">
        <MailCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div className="grid gap-1">
          <p className="font-semibold">Vérifie tes courriels</p>
          <p className="text-sm">
            Nous avons envoyé un lien de confirmation à{" "}
            <span className="font-medium break-all">{email}</span>.
          </p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Ouvre le lien pour activer ton compte. Si tu ne vois rien d&apos;ici quelques minutes,
        pense à regarder dans tes courriels indésirables.
      </p>
      <Button asChild size="lg" variant="outline" className="w-full">
        <Link href={routes.login}>Retour à la connexion</Link>
      </Button>
    </div>
  );
}
