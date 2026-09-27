import { describe, expect, it } from "vitest";

import { privateDocumentHeaders } from "@/config/security-headers";
import { DEFAULT_REPORT_OPTIONS, parseReportOptions, reportDocumentTitle, reportHref } from "@/features/reports/options";

describe("options du rapport PDF", () => {
  it("par défaut : 90 jours, réflexions seulement", () => {
    expect(parseReportOptions({})).toEqual(DEFAULT_REPORT_OPTIONS);
    expect(DEFAULT_REPORT_OPTIONS).toMatchObject({ includeConsumption: false, includeCravings: false, includePlan: false, includeAi: false });
  });

  it("aller-retour URL ↔ options", () => {
    const options = { period: "all" as const, includeReflections: false, includeConsumption: true, includeCravings: true, includePlan: true, includeAi: true };
    const url = new URL(reportHref(options), "http://localhost");
    expect(url.pathname).toBe("/reports/personal");
    expect(parseReportOptions(Object.fromEntries(url.searchParams))).toEqual(options);
  });

  it("valeurs inconnues → valeurs par défaut ; aucune option pour la lettre ni les contacts", () => {
    expect(parseReportOptions({ period: "10y", plan: "oui", letter: "1", contacts: "1" })).toEqual(DEFAULT_REPORT_OPTIONS);
    expect(reportHref(DEFAULT_REPORT_OPTIONS)).not.toMatch(/letter|contact/);
  });

  it("nom de fichier neutre", () => {
    expect(reportDocumentTitle("2026-09-26")).toBe("mon-parcours-2026-09-26");
  });

  it("en-têtes du rapport : jamais en cache, jamais indexé", () => {
    const byKey = new Map(privateDocumentHeaders.map((header) => [header.key, header.value]));
    expect(byKey.get("Cache-Control")).toMatch(/no-store/);
    expect(byKey.get("X-Robots-Tag")).toMatch(/noindex/);
  });
});
