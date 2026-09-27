import { describe, expect, it } from "vitest";

import { contentSecurityPolicy, securityHeaders } from "../../../next.config";
import { buildDataExport, EXPORT_VERSION, exportFilename, type ExportSource } from "@/features/settings/export";
import {
  deleteAccountSchema,
  displayNameUpdateSchema,
  emailChangeSchema,
  passwordChangeSchema,
  timezoneUpdateSchema,
} from "@/features/settings/schemas";
import { getSafeRedirect } from "@/lib/auth/redirects";
import { createRateLimiter, isSameOriginRequest } from "@/lib/security/request";

const headers = (values: Record<string, string>) => ({ get: (name: string) => values[name.toLowerCase()] ?? null });

describe("paramètres : validation", () => {
  it("fuseau IANA valide seulement", () => {
    expect(timezoneUpdateSchema.safeParse({ timezone: "America/Toronto" }).success).toBe(true);
    expect(timezoneUpdateSchema.safeParse({ timezone: "Mars/Olympus_Mons" }).success).toBe(false);
    expect(timezoneUpdateSchema.safeParse({ timezone: "UTC-4" }).success).toBe(false);
  });

  it("courriel invalide refusé, normalisé en minuscules", () => {
    expect(emailChangeSchema.safeParse({ email: "pas-un-courriel" }).success).toBe(false);
    expect(emailChangeSchema.parse({ email: " Nouveau@Example.COM " }).email).toBe("nouveau@example.com");
  });

  it("nom affiché : 2 à 80 caractères", () => {
    expect(displayNameUpdateSchema.safeParse({ displayName: "A" }).success).toBe(false);
    expect(displayNameUpdateSchema.safeParse({ displayName: "a".repeat(81) }).success).toBe(false);
    expect(displayNameUpdateSchema.parse({ displayName: "  Alexis  " }).displayName).toBe("Alexis");
  });

  it("mot de passe : confirmation identique, différent de l'actuel, 72 caractères max", () => {
    const base = { currentPassword: "ancien-fictif", password: "nouveau-fictif-2026", passwordConfirmation: "nouveau-fictif-2026" };
    expect(passwordChangeSchema.safeParse(base).success).toBe(true);
    expect(passwordChangeSchema.safeParse({ ...base, passwordConfirmation: "autre" }).success).toBe(false);
    expect(passwordChangeSchema.safeParse({ ...base, password: "ancien-fictif", passwordConfirmation: "ancien-fictif" }).success).toBe(false);
    expect(passwordChangeSchema.safeParse({ ...base, password: "a".repeat(73), passwordConfirmation: "a".repeat(73) }).success).toBe(false);
  });

  it("suppression : « SUPPRIMER » exact + mot de passe", () => {
    expect(deleteAccountSchema.safeParse({ confirmation: "SUPPRIMER", password: "fictif" }).success).toBe(true);
    expect(deleteAccountSchema.safeParse({ confirmation: " SUPPRIMER ", password: "fictif" }).success).toBe(true);
    expect(deleteAccountSchema.safeParse({ confirmation: "supprimer", password: "fictif" }).success).toBe(false);
    expect(deleteAccountSchema.safeParse({ confirmation: "OK", password: "fictif" }).success).toBe(false);
    expect(deleteAccountSchema.safeParse({ confirmation: "SUPPRIMER", password: "" }).success).toBe(false);
  });

  it("affectation de masse : user_id, created_at, role ignorés", () => {
    const parsed = displayNameUpdateSchema.parse({ displayName: "Alexis", user_id: "autre", created_at: "2000-01-01", role: "service_role" });
    expect(Object.keys(parsed)).toEqual(["displayName"]);
    const deletion = deleteAccountSchema.parse({ confirmation: "SUPPRIMER", password: "fictif", userId: "autre" });
    expect(Object.keys(deletion).sort()).toEqual(["confirmation", "password"]);
  });

  it("charge utile trop longue refusée proprement", () => {
    expect(displayNameUpdateSchema.safeParse({ displayName: "x".repeat(10_000) }).success).toBe(false);
    expect(emailChangeSchema.safeParse({ email: `${"a".repeat(300)}@example.com` }).success).toBe(false);
  });
});

describe("requêtes sensibles", () => {
  it("même origine exigée (Origin = hôte servi)", () => {
    expect(isSameOriginRequest(headers({ origin: "https://app.example", host: "app.example" }))).toBe(true);
    expect(isSameOriginRequest(headers({ origin: "https://evil.example", host: "app.example" }))).toBe(false);
    expect(isSameOriginRequest(headers({ host: "app.example" }))).toBe(false);
    expect(isSameOriginRequest(headers({ origin: "null", host: "app.example" }))).toBe(false);
    // Derrière le proxy de l'hébergeur
    expect(isSameOriginRequest(headers({ origin: "https://app.example", host: "10.0.0.5:3000", "x-forwarded-host": "app.example" }))).toBe(true);
  });

  it("limite de fréquence : un appel par fenêtre et par clé", () => {
    let now = 0;
    const limiter = createRateLimiter(10_000, () => now);
    expect(limiter.take("a")).toBe(true);
    expect(limiter.take("a")).toBe(false);
    expect(limiter.take("b")).toBe(true);
    now = 10_000;
    expect(limiter.take("a")).toBe(true);
  });

  it("redirections ouvertes refusées, y compris encodées", () => {
    for (const value of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "/%2F%2Fevil.example",
      "%2F%2Fevil.example",
      "javascript:alert(1)",
      "/today/../..//evil.example",
      "\t//evil.example",
    ]) {
      expect(getSafeRedirect(value, "/today")).toMatch(/^\/(?!\/)/);
      expect(getSafeRedirect(value, "/today")).not.toContain("evil.example");
    }
    expect(getSafeRedirect("/settings", "/today")).toBe("/settings");
  });
});

describe("en-têtes de sécurité", () => {
  const byKey = new Map(securityHeaders.map((header) => [header.key, header.value]));

  it("CSP : aucun cadre externe, aucun objet, formulaires et base limités", () => {
    expect(contentSecurityPolicy).toContain("frame-ancestors 'none'");
    expect(contentSecurityPolicy).toContain("object-src 'none'");
    expect(contentSecurityPolicy).toContain("base-uri 'self'");
    expect(contentSecurityPolicy).toContain("form-action 'self'");
    expect(contentSecurityPolicy).not.toContain("*;");
  });

  it("nosniff, referrer same-origin, API navigateur désactivées, pas d'iframe", () => {
    expect(byKey.get("X-Content-Type-Options")).toBe("nosniff");
    expect(byKey.get("Referrer-Policy")).toBe("same-origin");
    expect(byKey.get("Permissions-Policy")).toContain("geolocation=()");
    expect(byKey.get("Permissions-Policy")).toContain("camera=()");
    expect(byKey.get("X-Frame-Options")).toBe("DENY");
    expect(byKey.has("Access-Control-Allow-Origin")).toBe(false);
  });
});

describe("export des données", () => {
  const source: ExportSource = {
    account: { email: "fictif@example.com", created_at: "2026-09-01T12:00:00Z" },
    profile: { display_name: "Fictif", timezone: "America/Toronto", onboarding_completed: true, created_at: "2026-09-01T12:00:00Z" },
    substances: [
      { custom_name: null, goal: "abstinence", started_on: "2026-09-01", is_primary: true, is_active: true, created_at: "x", substances: { name_fr: "Cannabis" } },
      { custom_name: null, goal: "reduction", started_on: "2026-09-02", is_primary: false, is_active: false, created_at: "x", substances: { name_fr: "Nicotine" } },
    ],
    reasons: [{ reason_text: "Raison fictive.", created_at: "x", updated_at: "x" }],
    motivations: [{ motivation: "health", custom_label: null }],
    supportContacts: [{ name: "Marie", relationship: "Sœur", phone: null, email: null, is_primary: true }],
    checkins: [
      {
        checkin_date: "2026-09-20", status: "consumed", mood_score: 4, energy_score: 5, stress_score: 8, craving_score: 9,
        victory_text: null, proud_of_text: null, lesson_text: "<script>alert(1)</script>", tomorrow_intention_text: null, notes: null,
        completed_at: "x", created_at: "x", updated_at: "x",
        checkin_emotions: [{ emotions: { slug: "stress", name_fr: "Stress" } }],
        checkin_triggers: [{ custom_label: null, trigger_types: { slug: "work", name_fr: "Travail" } }],
        checkin_achievements: [],
        consumption_events: [
          { quantity: 2, unit: "joints", occurred_at: null, craving_before: 9, context_text: null, reflection_text: null, next_time_strategy_text: null, user_substances: { custom_name: null, substances: { name_fr: "Cannabis" } } },
          { quantity: 1, unit: "verre", occurred_at: null, craving_before: null, context_text: null, reflection_text: null, next_time_strategy_text: null, user_substances: { custom_name: null, substances: { name_fr: "Nicotine" } } },
        ],
      },
    ],
    cravingEvents: [
      {
        local_date: "2026-09-21", status: "completed", initial_craving_score: 8, final_craving_score: 5, trigger_unknown: false,
        context_text: null, outcome_text: null, started_at: "x", completed_at: "x",
        craving_event_substances: [{ user_substances: { custom_name: null, substances: { name_fr: "Cannabis" } } }],
        craving_event_emotions: [], craving_event_triggers: [],
        craving_interventions: { custom_strategy_text: null, helped_text: null, planned_duration_minutes: 10, actual_duration_seconds: 600, started_at: "x", completed_at: "x", craving_strategies: { slug: "walk", name_fr: "Marcher" } },
      },
    ],
    personalTriggers: [], personalStrategies: [], safePlaces: [{ name: "Parc", description: null, is_favorite: true, is_active: true }],
    reminder: { content: "Rappel fictif.", updated_at: "x" },
    letter: { title: null, content: "Lettre fictive.", updated_at: "x" },
    achievements: [{ earned_at: "x", achievement_definitions: { slug: "checkins-1", name_fr: "Premier check-in", category: "consistency" } }],
  };
  const data = buildDataExport(source, new Date("2026-09-26T15:00:00Z"));
  const json = JSON.stringify(data);

  it("structure versionnée avec métadonnées", () => {
    expect(data.export_version).toBe(EXPORT_VERSION);
    expect(data.exported_at).toBe("2026-09-26T15:00:00.000Z");
    expect(data.timezone).toBe("America/Toronto");
    expect(Object.keys(data)).toEqual(["export_version", "exported_at", "timezone", "account", "journey", "checkins", "craving_events", "personal_plan", "achievements"]);
  });

  it("toutes les catégories : multi-substance, consommations multiples, intervention, plan, lettre, accomplissements", () => {
    expect(data.journey.substances.map((item) => item.name)).toEqual(["Cannabis", "Nicotine"]);
    expect(data.checkins[0].consumption_events).toHaveLength(2);
    expect(data.craving_events[0].intervention?.strategy?.name).toBe("Marcher");
    expect(data.personal_plan.letter?.content).toBe("Lettre fictive.");
    expect(data.personal_plan.support_contacts[0].name).toBe("Marie");
    expect(data.achievements[0].slug).toBe("checkins-1");
  });

  it("aucun jeton, mot de passe, secret ni identifiant interne", () => {
    expect(json).not.toMatch(/token|password|secret|service_role|refresh|"id"|user_id|encrypted/i);
  });

  it("le texte est conservé tel quel (jamais interprété comme du HTML)", () => {
    expect(data.checkins[0].reflection.lesson).toBe("<script>alert(1)</script>");
  });

  it("nom de fichier neutre", () => {
    expect(exportFilename("2026-09-26")).toBe("mes-donnees-2026-09-26.json");
  });
});
