import { describe, expect, it } from "vitest";

import {
  formatLongDate,
  formatWeekdayDate,
  getLatestAllowedLocalDate,
  getUserToday,
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

describe("getUserToday", () => {
  it("UTC 01:30 à Toronto : la journée locale est encore la veille", () => {
    const utcOneThirty = new Date("2026-09-25T01:30:00Z");
    expect(utcOneThirty.toISOString().slice(0, 10)).toBe("2026-09-25");
    expect(getUserToday("America/Toronto", utcOneThirty)).toBe("2026-09-24");
  });

  it("même instant : Vancouver et Paris donnent des journées différentes", () => {
    const instant = new Date("2026-09-25T06:30:00Z");
    expect(getUserToday("America/Vancouver", instant)).toBe("2026-09-24");
    expect(getUserToday("Europe/Paris", instant)).toBe("2026-09-25");
  });

  it("utilise le fuseau par défaut si le profil n'en a pas", () => {
    expect(getUserToday(null, new Date("2026-09-25T01:30:00Z"))).toBe("2026-09-24");
    expect(getUserToday("UTC-4", new Date("2026-09-25T01:30:00Z"))).toBe("2026-09-24");
  });

  it("gère le passage à l'heure normale (novembre)", () => {
    // 1er novembre 2026 : passage à l'heure normale à Toronto.
    expect(getUserToday("America/Toronto", new Date("2026-11-02T04:30:00Z"))).toBe("2026-11-01");
    expect(getUserToday("America/Toronto", new Date("2026-11-02T05:30:00Z"))).toBe("2026-11-02");
  });
});

describe("formatWeekdayDate", () => {
  it("formate une journée locale avec le jour de la semaine", () => {
    expect(formatWeekdayDate("2026-09-24")).toBe("jeudi 24 septembre 2026");
  });
});
