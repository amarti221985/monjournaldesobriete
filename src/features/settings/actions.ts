"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { routes } from "@/config/routes";
import { getAuthErrorMessage } from "@/features/auth/errors";
import {
  deleteAccountSchema,
  displayNameUpdateSchema,
  emailChangeSchema,
  passwordChangeSchema,
  timezoneUpdateSchema,
} from "@/features/settings/schemas";
import { getCurrentUser } from "@/lib/auth/session";
import { getSiteUrl } from "@/lib/env";
import { isSameOriginRequest } from "@/lib/security/request";
import {
  changePassword,
  deleteCurrentAccount,
  requestEmailChange,
  signOutOtherSessions,
  updateDisplayName,
  updateTimezone,
  verifyCurrentPassword,
} from "@/lib/services/account";

/*
 * Server Actions des paramètres (Sprint 11). Pour chacune : session → validation Zod
 * (seuls les champs déclarés sont conservés) → vérifications → mutation limitée à
 * l'utilisateur connecté → erreurs génériques (jamais de SQL ni de pile). Aucun mot
 * de passe ni courriel n'est journalisé.
 */

export type SettingsActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; field?: string };

const SESSION_EXPIRED: SettingsActionState = { status: "error", message: "Ta session a expiré. Reconnecte-toi pour continuer." };
const GENERIC_ERROR = "Nous n'avons pas pu enregistrer cette modification. Réessaie dans quelques instants.";

function firstIssue(error: { issues: { message: string; path: PropertyKey[] }[] }): SettingsActionState {
  const issue = error.issues[0];
  return { status: "error", message: issue?.message ?? "Vérifie les informations saisies.", field: issue?.path[0]?.toString() };
}

export async function updateDisplayNameAction(_previous: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const user = await getCurrentUser();
  if (!user) return SESSION_EXPIRED;
  const parsed = displayNameUpdateSchema.safeParse({ displayName: formData.get("displayName") ?? "" });
  if (!parsed.success) return firstIssue(parsed.error);
  const result = await updateDisplayName(user.id, parsed.data.displayName);
  if (!result.ok) return { status: "error", message: GENERIC_ERROR };
  revalidatePath("/", "layout");
  return { status: "success", message: "Modifications enregistrées" };
}

export async function updateTimezoneAction(_previous: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const user = await getCurrentUser();
  if (!user) return SESSION_EXPIRED;
  const parsed = timezoneUpdateSchema.safeParse({ timezone: formData.get("timezone") ?? "" });
  if (!parsed.success) return firstIssue(parsed.error);
  const result = await updateTimezone(user.id, parsed.data.timezone);
  if (!result.ok) return { status: "error", message: GENERIC_ERROR };
  revalidatePath("/", "layout");
  return { status: "success", message: "Modifications enregistrées" };
}

export async function requestEmailChangeAction(_previous: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const user = await getCurrentUser();
  if (!user) return SESSION_EXPIRED;
  const parsed = emailChangeSchema.safeParse({ email: formData.get("email") ?? "" });
  if (!parsed.success) return firstIssue(parsed.error);
  if (parsed.data.email === user.email?.toLowerCase()) {
    return { status: "error", message: "C'est déjà ton adresse courriel.", field: "email" };
  }
  const callback = new URL(routes.authCallback, getSiteUrl());
  callback.searchParams.set("next", routes.settings);
  const result = await requestEmailChange(parsed.data.email, callback.toString());
  if (!result.ok) {
    return { status: "error", message: result.code ? getAuthErrorMessage(result.code, "signup") : GENERIC_ERROR };
  }
  return {
    status: "success",
    message: "Un courriel de confirmation a été envoyé. Ton adresse changera après la confirmation.",
  };
}

export async function changePasswordAction(_previous: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const user = await getCurrentUser();
  if (!user?.email) return SESSION_EXPIRED;
  const parsed = passwordChangeSchema.safeParse({
    currentPassword: formData.get("currentPassword") ?? "",
    password: formData.get("password") ?? "",
    passwordConfirmation: formData.get("passwordConfirmation") ?? "",
  });
  if (!parsed.success) return firstIssue(parsed.error);
  // Réauthentification réelle : le mot de passe actuel est vérifié auprès de Supabase Auth.
  if (!(await verifyCurrentPassword(user.email, parsed.data.currentPassword))) {
    return { status: "error", message: "Ce mot de passe ne correspond pas à ton mot de passe actuel.", field: "currentPassword" };
  }
  const result = await changePassword(parsed.data.password);
  if (!result.ok) {
    if (result.code === "reauthentication_needed") {
      return { status: "error", message: "Pour des raisons de sécurité, reconnecte-toi puis réessaie." };
    }
    return { status: "error", message: result.code ? getAuthErrorMessage(result.code, "resetPassword") : GENERIC_ERROR };
  }
  return { status: "success", message: "Ton mot de passe a été mis à jour." };
}

export async function signOutOtherSessionsAction(): Promise<SettingsActionState> {
  const user = await getCurrentUser();
  if (!user) return SESSION_EXPIRED;
  const result = await signOutOtherSessions();
  return result.ok
    ? { status: "success", message: "Tes autres appareils ont été déconnectés." }
    : { status: "error", message: GENERIC_ERROR };
}

/**
 * Suppression définitive du compte (ADR-077). Vérifications, dans l'ordre : session,
 * même origine, mot « SUPPRIMER », mot de passe actuel (réauthentification), puis
 * RPC delete_my_account() — qui ne vise que auth.uid() — et nettoyage de la session.
 */
export async function deleteAccountAction(_previous: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const user = await getCurrentUser();
  if (!user?.email) return SESSION_EXPIRED;
  if (!isSameOriginRequest(await headers())) {
    return { status: "error", message: "Cette demande n'a pas pu être vérifiée. Recharge la page et réessaie." };
  }
  const parsed = deleteAccountSchema.safeParse({
    confirmation: formData.get("confirmation") ?? "",
    password: formData.get("password") ?? "",
  });
  if (!parsed.success) return firstIssue(parsed.error);
  if (!(await verifyCurrentPassword(user.email, parsed.data.password))) {
    return { status: "error", message: "Ce mot de passe ne correspond pas à ton mot de passe actuel.", field: "password" };
  }
  const result = await deleteCurrentAccount();
  if (!result.ok) {
    return { status: "error", message: "Ton compte n'a pas pu être supprimé. Aucune donnée n'a été effacée. Réessaie dans quelques instants." };
  }
  redirect(routes.accountDeleted);
}
