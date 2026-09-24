import { describe, expect, it } from "vitest";

import { getAuthErrorMessage, getLoginPageError } from "@/features/auth/errors";

describe("getAuthErrorMessage", () => {
  it("affiche un message générique pour des identifiants invalides (pas d'énumération)", () => {
    const message = getAuthErrorMessage("invalid_credentials", "login");
    expect(message).toBe("Impossible de se connecter avec ces informations.");
    expect(getAuthErrorMessage("user_not_found", "login")).toBe(message);
    expect(getAuthErrorMessage(undefined, "login")).toBe(message);
  });

  it("ne confirme pas l'existence d'un compte à l'inscription", () => {
    const generic = getAuthErrorMessage(undefined, "signup");
    expect(getAuthErrorMessage("user_already_exists", "signup")).toBe(generic);
    expect(getAuthErrorMessage("email_exists", "signup")).toBe(generic);
    expect(generic).not.toMatch(/existe/i);
  });

  it("signale la limitation de débit", () => {
    expect(getAuthErrorMessage("over_request_rate_limit", "login")).toMatch(/Trop de tentatives/);
    expect(getAuthErrorMessage("over_email_send_rate_limit", "signup")).toMatch(/Trop de tentatives/);
  });

  it("traduit les erreurs de mot de passe à la réinitialisation", () => {
    expect(getAuthErrorMessage("same_password", "resetPassword")).toMatch(/différent/);
    expect(getAuthErrorMessage("weak_password", "resetPassword")).toMatch(/trop facile/);
  });
});

describe("getLoginPageError", () => {
  it("retourne un message pour un code connu", () => {
    expect(getLoginPageError("link_invalid")).toMatch(/invalide ou a expiré/);
  });

  it.each(["inconnu", "<script>", "toString", "__proto__", undefined, 3])(
    "ignore un code inconnu (%s)",
    (code) => {
      expect(getLoginPageError(code)).toBeNull();
    },
  );
});
