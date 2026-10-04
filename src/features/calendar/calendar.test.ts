import { describe, expect, it } from "vitest";

import {
  buildMonthGrid,
  buildYear,
  getCalendarDayHref,
  getCalendarDayState,
  getMonthNavigation,
  parseCalendarParams,
  type CalendarEntry,
} from "@/features/calendar/logic";
import { addMonths, formatMonthYear, getDaysInMonth, getMonthKey, getUserToday } from "@/lib/dates";

const done = (date: string, status: CalendarEntry["status"]): CalendarEntry => ({ date, status, completed: true });
const draft = (date: string): CalendarEntry => ({ date, status: "sober", completed: false });

describe("longueur des mois", () => {
  it.each([
    ["2026-02", 28],
    ["2028-02", 29],
    ["2000-02", 29],
    ["2100-02", 28],
    ["2026-09", 30],
    ["2026-10", 31],
  ])("%s → %d jours", (month, days) => {
    expect(getDaysInMonth(month)).toBe(days);
  });

  it("addMonths traverse les années", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-09", -21)).toBe("2024-12");
  });

  it("formate le mois en français", () => {
    expect(formatMonthYear("2026-09")).toBe("septembre 2026");
  });
});

describe("grille mensuelle (lundi → dimanche)", () => {
  const today = "2026-09-24";

  it("mois commençant un lundi : aucune case vide au début (juin 2026)", () => {
    const grid = buildMonthGrid("2026-06", today, [], null);
    expect(grid[0][0]?.date).toBe("2026-06-01");
    expect(grid.flat().filter(Boolean)).toHaveLength(30);
  });

  it("mois commençant un dimanche : 6 cases vides avant le 1er (novembre 2026)", () => {
    const grid = buildMonthGrid("2026-11", today, [], null);
    expect(grid[0].slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(grid[0][6]?.date).toBe("2026-11-01");
    expect(grid.every((week) => week.length === 7)).toBe(true);
  });

  it("février 28 jours commençant un lundi tient en 4 semaines (février 2027)", () => {
    const grid = buildMonthGrid("2027-02", "2027-03-01", [], null);
    expect(grid).toHaveLength(4);
    expect(grid.flat().filter(Boolean)).toHaveLength(28);
  });

  it("février bissextile : 29 jours (2028)", () => {
    expect(buildMonthGrid("2028-02", "2028-03-01", [], null).flat().filter(Boolean)).toHaveLength(29);
  });

  it("mois de 31 jours (octobre 2026)", () => {
    const days = buildMonthGrid("2026-10", "2026-10-31", [], null).flat().filter(Boolean);
    expect(days).toHaveLength(31);
    expect(days.at(-1)?.date).toBe("2026-10-31");
  });

  it("états : sobre, forte envie, consommation, brouillon, absence, aujourd'hui, futur, avant parcours", () => {
    const grid = buildMonthGrid(
      "2026-09",
      today,
      [done("2026-09-10", "sober"), done("2026-09-11", "sober_with_craving"), done("2026-09-12", "consumed"), draft("2026-09-24")],
      "2026-09-05",
    );
    const byDate = new Map(grid.flat().filter((day) => day !== null).map((day) => [day.date, day]));
    expect(byDate.get("2026-09-01")?.state).toBe("before_journey");
    expect(byDate.get("2026-09-10")?.state).toBe("sober");
    expect(byDate.get("2026-09-11")?.state).toBe("challenging");
    expect(byDate.get("2026-09-12")?.state).toBe("consumed");
    expect(byDate.get("2026-09-13")?.state).toBe("untracked");
    expect(byDate.get("2026-09-24")).toMatchObject({ state: "draft", isToday: true });
    expect(byDate.get("2026-09-25")?.state).toBe("future");
  });
});

describe("état d'une journée", () => {
  const today = "2026-09-24";

  it("un futur n'est jamais « non documenté », même avec un parcours plus tardif", () => {
    expect(getCalendarDayState("2026-09-30", today, undefined, "2026-10-01")).toBe("future");
  });

  it("un check-in terminé avant le début déclaré reste affiché (données importées ou modifiées)", () => {
    expect(getCalendarDayState("2026-08-01", today, done("2026-08-01", "sober"), "2026-09-01")).toBe("sober");
  });

  it("aujourd'hui sans check-in : non documenté, pas futur", () => {
    expect(getCalendarDayState(today, today, undefined, null)).toBe("untracked");
  });
});

describe("liens des journées", () => {
  const day = (date: string, state: ReturnType<typeof getCalendarDayState>, isToday = false) => ({
    date,
    dayOfMonth: Number(date.slice(8)),
    state,
    isToday,
  });

  it("journée terminée → détail du journal", () => {
    expect(getCalendarDayHref(day("2026-09-10", "sober"))).toBe("/journal/2026-09-10");
    expect(getCalendarDayHref(day("2026-09-12", "consumed"))).toBe("/journal/2026-09-12");
  });

  it("aujourd'hui sans check-in ou en cours → check-in du jour", () => {
    expect(getCalendarDayHref(day("2026-09-24", "untracked", true))).toBe("/today/checkin");
    expect(getCalendarDayHref(day("2026-09-24", "draft", true))).toBe("/today/checkin");
  });

  it("journée passée non documentée ou en cours → détail (check-in d'une journée passée, ADR-098)", () => {
    expect(getCalendarDayHref(day("2026-09-13", "untracked"))).toBe("/journal/2026-09-13");
    expect(getCalendarDayHref(day("2026-09-20", "draft"))).toBe("/journal/2026-09-20");
  });

  it("futur et avant le parcours : non cliquables", () => {
    expect(getCalendarDayHref(day("2026-09-30", "future"))).toBeNull();
    expect(getCalendarDayHref(day("2026-08-01", "before_journey"))).toBeNull();
  });
});

describe("vue année", () => {
  it("12 mois, 365 ou 366 jours, résumé réutilisant les métriques communes", () => {
    const entries = [done("2028-02-29", "sober"), done("2028-03-01", "sober_with_craving"), done("2028-03-02", "consumed"), draft("2028-03-03")];
    const { months, summary } = buildYear(2028, "2028-12-31", entries, "2028-01-01");
    expect(months).toHaveLength(12);
    expect(months.flatMap((month) => month.days)).toHaveLength(366);
    expect(summary).toMatchObject({ trackedDays: 3, soberDays: 2, consumedDays: 1, challengingDays: 1 });
    expect(summary.untrackedDays).toBe(366 - 3);
    expect(months[1].summary).toMatchObject({ trackedDays: 1, soberDays: 1 });
    expect(buildYear(2026, "2026-12-31", [], null).months.flatMap((month) => month.days)).toHaveLength(365);
  });

  it("les jours futurs et avant parcours ne sont pas comptés comme non documentés", () => {
    const { summary } = buildYear(2026, "2026-09-24", [], "2026-09-20");
    expect(summary.untrackedDays).toBe(5); // 20 → 24 septembre
  });
});

describe("paramètres et navigation (fuseau)", () => {
  it("UTC 1er octobre 01:00 = 30 septembre à Toronto : le calendrier ouvre septembre", () => {
    const today = getUserToday("America/Toronto", new Date("2026-10-01T01:00:00Z"));
    expect(today).toBe("2026-09-30");
    expect(parseCalendarParams({}, today)).toEqual({ view: "month", monthKey: "2026-09", year: 2026 });
  });

  it("changement d'année : UTC 1er janvier 03:00 = 31 décembre à Vancouver", () => {
    const today = getUserToday("America/Vancouver", new Date("2027-01-01T03:00:00Z"));
    expect(getMonthKey(today)).toBe("2026-12");
    expect(parseCalendarParams({ view: "year" }, today).year).toBe(2026);
  });

  it("minuit local : 23 h 59 à Toronto reste le 30 septembre", () => {
    expect(getUserToday("America/Toronto", new Date("2026-10-01T03:59:00Z"))).toBe("2026-09-30");
    expect(getUserToday("America/Toronto", new Date("2026-10-01T04:00:00Z"))).toBe("2026-10-01");
  });

  it("refuse le futur et les valeurs invalides", () => {
    const today = "2026-09-24";
    expect(parseCalendarParams({ month: "2026-11" }, today).monthKey).toBe("2026-09");
    expect(parseCalendarParams({ month: "2026-13" }, today).monthKey).toBe("2026-09");
    expect(parseCalendarParams({ month: "abc" }, today).monthKey).toBe("2026-09");
    expect(parseCalendarParams({ view: "year", year: "2030" }, today).year).toBe(2026);
    expect(parseCalendarParams({ view: "year", year: "1850" }, today).year).toBe(2026);
    expect(parseCalendarParams({ month: "2025-03" }, today)).toMatchObject({ monthKey: "2025-03", year: 2025 });
  });

  it("pas de mois suivant au-delà du mois en cours", () => {
    expect(getMonthNavigation("2026-09", "2026-09-24")).toEqual({ previous: "2026-08", next: null, isCurrent: true });
    expect(getMonthNavigation("2026-07", "2026-09-24")).toEqual({ previous: "2026-06", next: "2026-08", isCurrent: false });
  });
});
