/**
 * Traduction des erreurs Supabase Auth en messages humains.
 *
 * Règles :
 * - ne jamais afficher le message technique brut de Supabase;
 * - ne pas faciliter l'énumération des comptes (pas de « ce courriel existe »).
 */

export type AuthErrorContext = "login" | "signup" | "resetPassword";

const RATE_LIMIT_CODES = new Set([
  "over_request_rate_limit",
  "over_email_send_rate_limit",
]);

const GENERIC_MESSAGES: Record<AuthErrorContext, string> = {
  login: "Impossible de se connecter avec ces informations.",
  // Ne confirme pas l'existence d'un compte, mais évite l'impasse : chemin vers la connexion.
  signup:
    "Impossible de créer un compte avec ces informations. Si tu as déjà un compte, connecte-toi ou utilise « Mot de passe oublié ».",
  resetPassword: "Impossible de mettre à jour le mot de passe pour le moment. Réessaie dans quelques instants.",
};

export function getAuthErrorMessage(code: string | undefined, context: AuthErrorContext): string {
  if (code && RATE_LIMIT_CODES.has(code)) {
    return "Trop de tentatives. Réessaie dans quelques minutes.";
  }

  switch (context) {
    case "login":
      // Le mot de passe est correct dans ce cas : l'information ne révèle rien de plus.
      if (code === "email_not_confirmed") {
        return "Confirme d'abord ton adresse courriel à l'aide du lien reçu, puis reconnecte-toi.";
      }
      return GENERIC_MESSAGES.login;

    case "signup":
      if (code === "weak_password") {
        return "Ce mot de passe est trop facile à deviner. Choisis-en un plus long ou plus original.";
      }
      // user_already_exists / email_exists : message générique, sans confirmer l'existence du compte.
      return GENERIC_MESSAGES.signup;

    case "resetPassword":
      if (code === "same_password") {
        return "Choisis un mot de passe différent de l'ancien.";
      }
      if (code === "weak_password") {
        return "Ce mot de passe est trop facile à deviner. Choisis-en un plus long ou plus original.";
      }
      return GENERIC_MESSAGES.resetPassword;
  }
}

/** Codes d'erreur affichables sur la page de connexion (paramètre `?error=`). */
export const loginPageErrors = {
  link_invalid: "Ce lien est invalide ou a expiré. Tu peux en demander un nouveau.",
} as const;

export type LoginPageErrorCode = keyof typeof loginPageErrors;

export function getLoginPageError(code: unknown): string | null {
  return typeof code === "string" && Object.hasOwn(loginPageErrors, code)
    ? loginPageErrors[code as LoginPageErrorCode]
    : null;
}
