import { describe, expect, it } from "vitest";

import {
  formatLongDate,
  getLatestAllowedLocalDate,
  getLocalDateString,
  isAfterDate,
  isValidDateString,
} from "@/lib/dates";

describe("isValidDateString", () => {
  it.each(["2026-09-24", "2024-02-29", "1900-01-01"])("accepte %s", (value) => {
    expect(isValidDateString(value)).toBe(true);
  });

  it.each(["2026-02-30", "2025-02-29", "2026-13-01", "24/09/2026", "2026-9-24", "", "2026-09-24T00:00"])(
    "refuse %s",
    (value) => {
      expect(isValidDateString(value)).toBe(false);
    },
  );
});

describe("getLocalDateString", () => {
  // 25 septembre 2026, 02 h 30 UTC = 24 septembre, 22 h 30 à Toronto.
  const lateEveningToronto = new Date("2026-09-25T02:30:00Z");

  it("retourne la journée locale, pas la date UTC", () => {
    expect(getLocalDateString("America/Toronto", lateEveningToronto)).toBe("2026-09-24");
    expect(getLocalDateString("Europe/Paris", lateEveningToronto)).toBe("2026-09-25");
  });

  it("gère le changement d'année", () => {
    const newYearUtc = new Date("2027-01-01T03:00:00Z");
    expect(getLocalDateString("America/Vancouver", newYearUtc)).toBe("2026-12-31");
  });
});

describe("getLatestAllowedLocalDate", () => {
  const now = new Date("2026-09-25T02:30:00Z");

  it("utilise le fuseau du profil", () => {
    expect(getLatestAllowedLocalDate("America/Toronto", now)).toBe("2026-09-24");
  });

  it("utilise le fuseau le plus en avance si le fuseau est inconnu ou invalide", () => {
    expect(getLatestAllowedLocalDate(null, now)).toBe("2026-09-25");
    expect(getLatestAllowedLocalDate("UTC-4", now)).toBe("2026-09-25");
  });
});

describe("isAfterDate", () => {
  it("détecte une date future", () => {
    expect(isAfterDate("2026-09-25", "2026-09-24")).toBe(true);
    expect(isAfterDate("2026-09-24", "2026-09-24")).toBe(false);
    expect(isAfterDate("2025-12-31", "2026-01-01")).toBe(false);
  });
});

describe("formatLongDate", () => {
  it("formate en français sans décalage de fuseau", () => {
    expect(formatLongDate("2026-09-24")).toBe("24 septembre 2026");
    expect(formatLongDate("2027-01-01")).toBe("1 janvier 2027");
  });
});
