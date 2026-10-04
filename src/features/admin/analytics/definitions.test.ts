import { describe, expect, it } from "vitest";

import {
  buildFunnel,
  compareWithPrevious,
  formatComparison,
  getActivationStatus,
  getActivityStatus,
  getAdminRange,
  getBucket,
  getPreviousRange,
  isSmallSample,
  parseAdminPeriod,
  parsePage,
  parseUserFilter,
  parseUserSort,
  percentage,
  pseudonym,
  retentionCell,
} from "@/features/admin/analytics/definitions";

const NOW = new Date("2026-10-06T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

describe("périodes admin", () => {
  it("liste fermée, 30 jours par défaut", () => {
    expect(parseAdminPeriod("7d")).toBe("7d");
    expect(parseAdminPeriod("year")).toBe("year");
    expect(parseAdminPeriod("365d")).toBe("30d");
    expect(parseAdminPeriod(undefined)).toBe("30d");
  });

  it("plages UTC et période précédente de même durée", () => {
    const range = getAdminRange("30d", NOW);
    expect(range.to).toEqual(NOW);
    expect(NOW.getTime() - range.from.getTime()).toBe(30 * 86_400_000);
    expect(getAdminRange("year", NOW).from.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(getAdminRange("all", NOW).from.getTime()).toBe(0);
    const previous = getPreviousRange("7d", NOW);
    expect(previous?.to).toEqual(getAdminRange("7d", NOW).from);
    expect(previous && previous.to.getTime() - previous.from.getTime()).toBe(7 * 86_400_000);
    expect(getPreviousRange("all", NOW)).toBeNull();
    expect(getPreviousRange("year", NOW)).toBeNull();
  });

  it("granularité : jour jusqu'à 30 jours, semaine au-delà", () => {
    expect(getBucket("7d")).toBe("day");
    expect(getBucket("30d")).toBe("day");
    expect(getBucket("90d")).toBe("week");
    expect(getBucket("all")).toBe("week");
  });
});

describe("pourcentages et comparaisons", () => {
  it("dénominateur nul : pas de pourcentage (jamais 0 % ni ∞)", () => {
    expect(percentage(3, 4)).toBe(75);
    expect(percentage(0, 0)).toBeNull();
    expect(percentage(2, 0)).toBeNull();
  });

  it("période précédente à 0 : « Nouveau » ; sans période précédente : rien", () => {
    expect(formatComparison(compareWithPrevious(5, 0))).toBe("Nouveau");
    expect(formatComparison(compareWithPrevious(0, 0))).toBeNull();
    expect(formatComparison(compareWithPrevious(5, null))).toBeNull();
    expect(formatComparison(compareWithPrevious(6, 4))).toBe("+50 % vs période précédente");
    expect(formatComparison(compareWithPrevious(2, 4))).toBe("−50 % vs période précédente");
  });

  it("petit échantillon sous 20 comptes", () => {
    expect(isSmallSample(5)).toBe(true);
    expect(isSmallSample(20)).toBe(false);
  });
});

describe("statuts", () => {
  it("activation : onboarding terminé ET premier check-in", () => {
    expect(getActivationStatus({ onboarded: true, firstCheckinAt: daysAgo(3) })).toBe("activated");
    expect(getActivationStatus({ onboarded: true, firstCheckinAt: null })).toBe("not_activated");
    expect(getActivationStatus({ onboarded: false, firstCheckinAt: daysAgo(3) })).toBe("not_activated");
  });

  it("activité : actif ≤ 7 j, moins actif 8–14 j, inactif > 14 j ou jamais", () => {
    expect(getActivityStatus(daysAgo(2), NOW)).toBe("active");
    expect(getActivityStatus(daysAgo(7), NOW)).toBe("active");
    expect(getActivityStatus(daysAgo(10), NOW)).toBe("slowing");
    expect(getActivityStatus(daysAgo(15), NOW)).toBe("inactive");
    expect(getActivityStatus(null, NOW)).toBe("inactive");
  });

  it("pseudonyme : jamais de nom ni de courriel", () => {
    expect(pseudonym("A1B2C3D4")).toBe("Utilisateur #A1B2C3D4");
  });
});

describe("rétention et entonnoir", () => {
  it("cohorte immature : « — », jamais 0 %", () => {
    expect(retentionCell(0, 0)).toEqual({ label: "—", detail: null });
    expect(retentionCell(1, 2)).toEqual({ label: "50 %", detail: "1/2" });
    expect(retentionCell(0, 3)).toEqual({ label: "0 %", detail: "0/3" });
  });

  it("entonnoir : conversion depuis l'étape précédente ; J7 parmi les personnes éligibles", () => {
    const steps = buildFunnel({ signups: 10, onboarded: 8, firstCheckin: 6, returned: 3, j7Eligible: 2, activeJ7: 1 });
    expect(steps.map((step) => step.conversion)).toEqual([null, 80, 75, 50, 50]);
    expect(steps[4].note).toContain("2 personnes");
    expect(buildFunnel({ signups: 0, onboarded: 0, firstCheckin: 0, returned: 0, j7Eligible: 0, activeJ7: 0 }).map((s) => s.conversion)).toEqual([null, null, null, null, null]);
  });
});

describe("filtres de la liste", () => {
  it("valeurs inconnues → valeurs par défaut", () => {
    expect(parseUserFilter("inactive")).toBe("inactive");
    expect(parseUserFilter("admins")).toBe("all");
    expect(parseUserSort("activity")).toBe("activity");
    expect(parseUserSort("email")).toBe("recent");
    expect(parsePage("3")).toBe(3);
    expect(parsePage("-1")).toBe(1);
    expect(parsePage("abc")).toBe(1);
  });
});
