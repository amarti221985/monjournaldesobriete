"use server";

import type { AuthError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { routes } from "@/config/routes";
import { getAuthErrorMessage, type AuthErrorContext } from "@/features/auth/errors";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/features/auth/schemas";
import { getAuthenticatedHomeRoute, getSafeRedirect } from "@/lib/auth/redirects";
import { getCurrentUser } from "@/lib/auth/session";
import { getSiteUrl } from "@/lib/env";
import { getFieldErrors, readFormFields, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

/*
 * Server Actions d'authentification.
 * Chaque action revalide ses entrées côté serveur (Zod), même si le client l'a déjà fait.
 * Les journaux ne contiennent jamais de courriel, mot de passe, jeton ni cookie.
 */

export type SignupField = "displayName" | "email" | "password" | "passwordConfirmation";
export type SignupState = FormState<SignupField> & { confirmationEmail?: string };

export type LoginField = "email" | "password";
export type LoginState = FormState<LoginField>;

export type ForgotPasswordField = "email";
export type ForgotPasswordState = FormState<ForgotPasswordField>;

export type ResetPasswordField = "password" | "passwordConfirmation";
export type ResetPasswordState = FormState<ResetPasswordField>;

function logAuthError(context: AuthErrorContext | "forgotPassword" | "signOut", error: AuthError) {
  console.error(`[auth:${context}]`, { code: error.code, status: error.status });
}

/** URL absolue du callback Auth, basée sur NEXT_PUBLIC_SITE_URL (jamais codée en dur). */
function buildAuthCallbackUrl(next: string): string {
  const url = new URL(routes.authCallback, getSiteUrl());
  url.searchParams.set("next", next);
  return url.toString();
}

export async function signUpAction(_previous: SignupState, formData: FormData): Promise<SignupState> {
  const input = readFormFields(formData, [
    "displayName",
    "email",
    "password",
    "passwordConfirmation",
    "timezone",
  ] as const);
  const values = { displayName: input.displayName, email: input.email };

  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", fieldErrors: getFieldErrors(parsed.error), values };
  }

  const { displayName, email, password, timezone } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: buildAuthCallbackUrl(getAuthenticatedHomeRoute()),
      // Lues et revalidées par le trigger public.handle_new_user().
      data: { display_name: displayName, ...(timezone ? { timezone } : {}) },
    },
  });

  if (error) {
    logAuthError("signup", error);
    return { status: "error", message: getAuthErrorMessage(error.code, "signup"), values };
  }

  // Confirmation du courriel désactivée : la session existe déjà.
  if (data.session) redirect(getAuthenticatedHomeRoute());

  // Confirmation activée (ou compte déjà existant : Supabase répond de la même façon,
  // ce qui évite de révéler l'existence du compte).
  return { status: "success", confirmationEmail: email };
}

export async function signInAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const input = readFormFields(formData, ["email", "password", "next"] as const);
  const values = { email: input.email };

  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", fieldErrors: getFieldErrors(parsed.error), values };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    logAuthError("login", error);
    return { status: "error", message: getAuthErrorMessage(error.code, "login"), values };
  }

  redirect(getSafeRedirect(parsed.data.next));
}

const FORGOT_PASSWORD_CONFIRMATION =
  "Si un compte correspond à cette adresse, un courriel permettant de réinitialiser le mot de passe sera envoyé.";

export async function requestPasswordResetAction(
  _previous: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const input = readFormFields(formData, ["email"] as const);

  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", fieldErrors: getFieldErrors(parsed.error), values: input };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: buildAuthCallbackUrl(routes.resetPassword),
  });

  if (error) {
    logAuthError("forgotPassword", error);
    if (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") {
      return {
        status: "error",
        message: getAuthErrorMessage(error.code, "login"),
        values: input,
      };
    }
  }

  // Même réponse que le compte existe ou non (pas d'énumération des comptes).
  return { status: "success", message: FORGOT_PASSWORD_CONFIRMATION };
}

export async function updatePasswordAction(
  _previous: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      status: "error",
      message: "Ce lien a expiré. Demande un nouveau lien de réinitialisation.",
    };
  }

  const parsed = resetPasswordSchema.safeParse(
    readFormFields(formData, ["password", "passwordConfirmation"] as const),
  );
  if (!parsed.success) {
    return { status: "error", fieldErrors: getFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    logAuthError("resetPassword", error);
    return { status: "error", message: getAuthErrorMessage(error.code, "resetPassword") };
  }

  return { status: "success", message: "Ton mot de passe a été mis à jour." };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) logAuthError("signOut", error);
  redirect(routes.login);
}
