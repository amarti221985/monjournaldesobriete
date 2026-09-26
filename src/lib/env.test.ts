import { describe, expect, it } from "vitest";

import { cleanEnvValue, EnvValidationError, parseSiteUrl, parseSupabaseEnv } from "@/lib/env";

describe("parseSupabaseEnv", () => {
  it("retourne la configuration lorsque les variables sont valides", () => {
    expect(
      parseSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      }),
    ).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_test",
    });
  });

  it("échoue clairement lorsque les variables sont absentes", () => {
    expect(() => parseSupabaseEnv({})).toThrow(EnvValidationError);
    expect(() => parseSupabaseEnv({})).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
    );
  });

  it("traite une valeur vide (copie brute de .env.example) comme absente", () => {
    expect(() =>
      parseSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "  ",
      }),
    ).toThrow(EnvValidationError);
  });

  it("refuse une URL qui n'est pas http(s)", () => {
    expect(() =>
      parseSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_URL: "ftp://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});

describe("parseSiteUrl", () => {
  it("utilise localhost par défaut", () => {
    expect(parseSiteUrl({}).href).toBe("http://localhost:3000/");
    expect(parseSiteUrl({ NEXT_PUBLIC_SITE_URL: "" }).href).toBe(
      "http://localhost:3000/",
    );
  });

  it("utilise l'URL fournie", () => {
    expect(
      parseSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://journal.example.com" }).origin,
    ).toBe("https://journal.example.com");
  });
});

describe("cleanEnvValue", () => {
  it("retire espaces et guillemets entourants copiés d'un panneau d'hébergement", () => {
    expect(cleanEnvValue('  "https://exemple.supabase.co"  ')).toBe("https://exemple.supabase.co");
    expect(cleanEnvValue("'sb_publishable_fictif'")).toBe("sb_publishable_fictif");
    expect(cleanEnvValue('   ')).toBeUndefined();
  });

  it("accepte une URL Supabase entourée de guillemets", () => {
    const env = parseSupabaseEnv({
      NEXT_PUBLIC_SUPABASE_URL: '"https://exemple.supabase.co"',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: " sb_publishable_fictif ",
    });
    expect(env).toEqual({ url: "https://exemple.supabase.co", publishableKey: "sb_publishable_fictif" });
  });
});
