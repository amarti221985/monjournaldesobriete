import { describe, expect, it } from "vitest";

import {
  displayNameSchema,
  emailSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/features/auth/schemas";
import { getFieldErrors } from "@/lib/forms";

const validSignup = {
  displayName: "Alexis",
  email: "alexis@example.com",
  password: "un mot de passe",
  passwordConfirmation: "un mot de passe",
};

function signupErrors(overrides: Partial<Record<keyof typeof validSignup | "timezone", unknown>>) {
  const result = signupSchema.safeParse({ ...validSignup, ...overrides });
  return result.success ? {} : getFieldErrors(result.error);
}

describe("displayNameSchema", () => {
  it("nettoie les espaces", () => {
    expect(displayNameSchema.parse("  Marie   Ève  ")).toBe("Marie Ève");
  });

  it.each([
    ["vide", "", "Indique ton prénom ou un nom d'affichage."],
    ["espaces seulement", "   ", "Indique ton prénom ou un nom d'affichage."],
    ["trop court", "A", "Au moins 2 caractères."],
    ["trop long", "A".repeat(81), "80 caractères maximum."],
  ])("refuse un nom %s", (_label, value, message) => {
    const result = displayNameSchema.safeParse(value);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });

  it("refuse les caractères de contrôle", () => {
    expect(displayNameSchema.safeParse("Ale\u0000xis").success).toBe(false);
  });

  it("accepte 80 caractères", () => {
    expect(displayNameSchema.safeParse("A".repeat(80)).success).toBe(true);
  });
});

describe("emailSchema", () => {
  it("normalise l'adresse (espaces, minuscules)", () => {
    expect(emailSchema.parse("  Alexis@Example.COM ")).toBe("alexis@example.com");
  });

  it.each(["", "alexis", "alexis@", "@example.com", "alexis@example", "alexis example@test.com"])(
    "refuse l'adresse invalide « %s »",
    (value) => {
      expect(emailSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe("signupSchema", () => {
  it("accepte une inscription valide", () => {
    expect(signupSchema.safeParse(validSignup).success).toBe(true);
  });

  it("refuse un courriel invalide", () => {
    expect(signupErrors({ email: "pas-un-courriel" }).email).toBe(
      "Cette adresse courriel ne semble pas valide.",
    );
  });

  it("refuse un mot de passe de moins de 8 caractères", () => {
    expect(
      signupErrors({ password: "court", passwordConfirmation: "court" }).password,
    ).toBe("Au moins 8 caractères.");
  });

  it("n'impose pas de règles arbitraires (majuscule, chiffre, symbole)", () => {
    expect(
      signupSchema.safeParse({
        ...validSignup,
        password: "simplement long",
        passwordConfirmation: "simplement long",
      }).success,
    ).toBe(true);
  });

  it("refuse un mot de passe de plus de 72 caractères", () => {
    const long = "a".repeat(73);
    expect(signupErrors({ password: long, passwordConfirmation: long }).password).toBe(
      "72 caractères maximum.",
    );
  });

  it("refuse une confirmation différente", () => {
    expect(signupErrors({ passwordConfirmation: "autre chose" }).passwordConfirmation).toBe(
      "Les deux mots de passe ne correspondent pas.",
    );
  });

  it("ne modifie pas le mot de passe (espaces conservés)", () => {
    const result = signupSchema.parse({
      ...validSignup,
      password: " espaces  inclus ",
      passwordConfirmation: " espaces  inclus ",
    });
    expect(result.password).toBe(" espaces  inclus ");
  });

  it("refuse un nom invalide", () => {
    expect(signupErrors({ displayName: "A" }).displayName).toBe("Au moins 2 caractères.");
  });

  it("conserve un fuseau IANA valide et ignore un fuseau invalide", () => {
    expect(signupSchema.parse({ ...validSignup, timezone: "America/Toronto" }).timezone).toBe(
      "America/Toronto",
    );
    expect(signupSchema.parse({ ...validSignup, timezone: "UTC-4" }).timezone).toBeUndefined();
  });
});

describe("loginSchema", () => {
  it("accepte des identifiants sans appliquer les règles de création", () => {
    expect(loginSchema.safeParse({ email: "a@example.com", password: "court" }).success).toBe(true);
  });

  it("exige un mot de passe", () => {
    const result = loginSchema.safeParse({ email: "a@example.com", password: "" });
    expect(result.success).toBe(false);
  });
});

describe("forgotPasswordSchema", () => {
  it("exige un courriel valide", () => {
    expect(forgotPasswordSchema.safeParse({ email: "a@example.com" }).success).toBe(true);
    expect(forgotPasswordSchema.safeParse({ email: "invalide" }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("accepte deux mots de passe identiques et assez longs", () => {
    expect(
      resetPasswordSchema.safeParse({
        password: "nouveau mot de passe",
        passwordConfirmation: "nouveau mot de passe",
      }).success,
    ).toBe(true);
  });

  it("refuse un mot de passe trop court", () => {
    const result = resetPasswordSchema.safeParse({ password: "court", passwordConfirmation: "court" });
    expect(result.success ? {} : getFieldErrors(result.error)).toMatchObject({
      password: "Au moins 8 caractères.",
    });
  });

  it("refuse une confirmation différente", () => {
    const result = resetPasswordSchema.safeParse({
      password: "nouveau mot de passe",
      passwordConfirmation: "nouveau mot de passE",
    });
    expect(result.success ? {} : getFieldErrors(result.error)).toMatchObject({
      passwordConfirmation: "Les deux mots de passe ne correspondent pas.",
    });
  });
});
