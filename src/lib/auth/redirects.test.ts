import { describe, expect, it } from "vitest";

import { buildLoginUrl, getSafeRedirect, resolveProxyRedirect } from "@/lib/auth/redirects";

describe("getSafeRedirect", () => {
  it.each([
    ["/today", "/today"],
    ["/today?tab=semaine", "/today?tab=semaine"],
    ["/today#section", "/today#section"],
    ["/reset-password", "/reset-password"],
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
