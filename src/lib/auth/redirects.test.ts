import { describe, expect, it } from "vitest";

import {
  buildLoginUrl,
  getAppAccessRedirect,
  getAuthenticatedHomeRoute,
  getOnboardingAccessRedirect,
  getSafeRedirect,
  needsOnboardingState,
  resolvePostLoginRedirect,
  resolveRedirectOrigin,
  resolveProxyRedirect,
} from "@/lib/auth/redirects";

describe("getSafeRedirect", () => {
  it.each([
    ["/today", "/today"],
    ["/today?tab=semaine", "/today?tab=semaine"],
    ["/today#section", "/today#section"],
    ["/reset-password", "/reset-password"],
    ["/onboarding", "/onboarding"],
    ["/calendar/2026/09", "/calendar/2026/09"],
  ])("accepte le chemin interne autorisé %s", (input, expected) => {
    expect(getSafeRedirect(input)).toBe(expected);
  });

  it.each([
    ["URL absolue", "https://evil.com"],
    ["URL absolue http", "http://evil.com/today"],
    ["protocole relatif", "//evil.com"],
    ["protocole relatif vers un chemin autorisé", "//evil.com/today"],
    ["barre oblique inverse", "/\\evil.com"],
    ["barres obliques inverses", "\\\\evil.com"],
    ["javascript:", "javascript:alert(1)"],
    ["data:", "data:text/html,<script>alert(1)</script>"],
    ["chemin relatif", "today"],
    ["chaîne vide", ""],
    ["tabulation encodée par le navigateur", "/\t/evil.com"],
    ["saut de ligne", "/today\n"],
    ["espace initial", " /today"],
    ["route non autorisée", "/login"],
    ["callback Auth (boucle)", "/auth/callback"],
    ["accueil public", "/"],
    ["traversée vers une route non autorisée", "/today/../login"],
    ["préfixe trompeur", "/todayevil"],
    ["chemin trop long", `/today/${"a".repeat(600)}`],
  ])("refuse %s", (_label, input) => {
    expect(getSafeRedirect(input)).toBe("/today");
  });

  it.each([null, undefined, 42, {}, ["/today"]])("refuse une valeur non textuelle (%s)", (input) => {
    expect(getSafeRedirect(input)).toBe("/today");
  });

  it("utilise la destination de repli fournie", () => {
    expect(getSafeRedirect("https://evil.com", "/reset-password")).toBe("/reset-password");
  });
});

describe("buildLoginUrl", () => {
  it("conserve une destination sûre encodée", () => {
    expect(buildLoginUrl("/today?x=1")).toBe("/login?next=%2Ftoday%3Fx%3D1");
  });

  it("ignore une destination dangereuse", () => {
    expect(buildLoginUrl("//evil.com")).toBe("/login");
    expect(buildLoginUrl()).toBe("/login");
  });
});

describe("resolveProxyRedirect", () => {
  it("redirige un visiteur non connecté d'une route protégée vers la connexion", () => {
    expect(
      resolveProxyRedirect({ pathname: "/today", search: "", isAuthenticated: false }),
    ).toBe("/login?next=%2Ftoday");
  });

  it("protège aussi les sous-routes", () => {
    expect(
      resolveProxyRedirect({ pathname: "/journal/2026", search: "?q=a", isAuthenticated: false }),
    ).toBe("/login?next=%2Fjournal%2F2026%3Fq%3Da");
  });

  it("laisse un utilisateur connecté accéder à la zone protégée", () => {
    expect(
      resolveProxyRedirect({ pathname: "/today", search: "", isAuthenticated: true }),
    ).toBeNull();
  });

  it.each(["/login", "/signup"])("redirige un utilisateur connecté hors de %s", (pathname) => {
    expect(resolveProxyRedirect({ pathname, search: "", isAuthenticated: true })).toBe("/today");
  });

  it.each(["/", "/login", "/signup", "/forgot-password", "/reset-password", "/auth/callback"])(
    "laisse un visiteur accéder à %s",
    (pathname) => {
      expect(resolveProxyRedirect({ pathname, search: "", isAuthenticated: false })).toBeNull();
    },
  );

  it("laisse un utilisateur connecté accéder à la réinitialisation du mot de passe", () => {
    expect(
      resolveProxyRedirect({ pathname: "/reset-password", search: "", isAuthenticated: true }),
    ).toBeNull();
  });
});

describe("routage selon l'onboarding (Sprint 2)", () => {
  const incomplete = { onboarding_completed: false };
  const complete = { onboarding_completed: true };

  it("non authentifié : /onboarding → /login", () => {
    expect(
      resolveProxyRedirect({ pathname: "/onboarding", search: "", isAuthenticated: false }),
    ).toBe("/login?next=%2Fonboarding");
  });

  it("authentifié + onboarding incomplet : /today → /onboarding", () => {
    expect(getAppAccessRedirect(incomplete)).toBe("/onboarding");
  });

  it("authentifié + onboarding incomplet : /onboarding autorisé", () => {
    expect(getOnboardingAccessRedirect(incomplete)).toBeNull();
    expect(
      resolveProxyRedirect({ pathname: "/onboarding", search: "", isAuthenticated: true }),
    ).toBeNull();
  });

  it("authentifié + onboarding terminé : /onboarding → /today", () => {
    expect(getOnboardingAccessRedirect(complete)).toBe("/today");
  });

  it("authentifié + onboarding terminé : /today autorisé", () => {
    expect(getAppAccessRedirect(complete)).toBeNull();
  });

  it("profil introuvable : traité comme onboarding incomplet", () => {
    expect(getAppAccessRedirect(null)).toBe("/onboarding");
    expect(getOnboardingAccessRedirect(null)).toBeNull();
  });

  it("après connexion : onboarding si incomplet, même avec une destination demandée", () => {
    expect(resolvePostLoginRedirect(incomplete, "/journal")).toBe("/onboarding");
  });

  it("après connexion : destination sûre ou /today si terminé", () => {
    expect(resolvePostLoginRedirect(complete, "/journal")).toBe("/journal");
    expect(resolvePostLoginRedirect(complete, "https://evil.com")).toBe("/today");
    expect(resolvePostLoginRedirect(complete, undefined)).toBe("/today");
  });

  it("destination par défaut d'un utilisateur connecté", () => {
    expect(getAuthenticatedHomeRoute(incomplete)).toBe("/onboarding");
    expect(getAuthenticatedHomeRoute(complete)).toBe("/today");
    expect(getAuthenticatedHomeRoute()).toBe("/today");
  });
});

describe("proxy : routage selon l'onboarding", () => {
  const request = (pathname: string, onboardingCompleted?: boolean) =>
    resolveProxyRedirect({ pathname, search: "", isAuthenticated: true, onboardingCompleted });

  it("onboarding incomplet : /today → /onboarding", () => {
    expect(request("/today", false)).toBe("/onboarding");
  });

  it("onboarding incomplet : /onboarding autorisé", () => {
    expect(request("/onboarding", false)).toBeNull();
  });

  it("onboarding terminé : /onboarding → /today", () => {
    expect(request("/onboarding", true)).toBe("/today");
  });

  it("onboarding terminé : /today autorisé", () => {
    expect(request("/today", true)).toBeNull();
  });

  it("connecté sur /login ou /signup : destination selon l'onboarding", () => {
    expect(request("/login", false)).toBe("/onboarding");
    expect(request("/signup", true)).toBe("/today");
  });

  it("état inconnu : aucune redirection d'onboarding (le layout décide)", () => {
    expect(request("/today")).toBeNull();
    expect(request("/onboarding")).toBeNull();
  });

  it("n'interroge la base que pour les routes protégées ou réservées aux visiteurs", () => {
    expect(needsOnboardingState("/today")).toBe(true);
    expect(needsOnboardingState("/onboarding")).toBe(true);
    expect(needsOnboardingState("/login")).toBe(true);
    expect(needsOnboardingState("/")).toBe(false);
    expect(needsOnboardingState("/reset-password")).toBe(false);
    expect(needsOnboardingState("/auth/callback")).toBe(false);
  });
});

describe("resolveRedirectOrigin", () => {
  it("utilise l'URL publique configurée plutôt que l'adresse interne du serveur", () => {
    expect(resolveRedirectOrigin("https://0.0.0.0:3000/auth/callback?code=x", new URL("https://journal.example.com"))).toBe(
      "https://journal.example.com",
    );
  });

  it("en local (URL publique locale ou absente) : origine de la requête", () => {
    expect(resolveRedirectOrigin("http://127.0.0.1:3100/auth/callback", new URL("http://localhost:3000"))).toBe("http://127.0.0.1:3100");
    expect(resolveRedirectOrigin("http://localhost:3000/auth/callback", null)).toBe("http://localhost:3000");
  });
});
