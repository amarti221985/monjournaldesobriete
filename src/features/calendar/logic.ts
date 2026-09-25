import type { CalendarDayState } from "@/config/day-status";
import { routes } from "@/config/routes";
import type { CheckinStatus } from "@/features/checkin/constants";
import { statusOptions } from "@/features/checkin/constants";
import { calculateSobrietyMetrics, type SobrietyMetrics } from "@/features/progress/metrics";
import {
  addMonths,
  getDaysInMonth,
  getMondayBasedWeekday,
  getMonthKey,
  isValidMonthKey,
} from "@/lib/dates";

/*
 * Calendrier (ADR-047) : logique pure et testée. Dates = journées locales YYYY-MM-DD ;
 * « aujourd'hui » est fourni par getUserToday(profiles.timezone).
 */

/** Données minimales d'une journée pour le calendrier (jamais de texte personnel). */
export type CalendarEntry = {
  date: string;
  status: CheckinStatus;
  /** false = brouillon (ne compte pas comme journée suivie) */
  completed: boolean;
};

export type CalendarDay = {
  date: string;
  dayOfMonth: number;
  state: CalendarDayState;
  isToday: boolean;
};

export type CalendarView = "month" | "year";

/**
 * État d'une journée, dans cet ordre de priorité :
 * future → check-in terminé → brouillon → avant le parcours → non documentée.
 */
export function getCalendarDayState(
  date: string,
  today: string,
  entry: CalendarEntry | undefined,
  journeyStart: string | null,
): CalendarDayState {
  if (date > today) return "future";
  if (entry?.completed) return statusOptions[entry.status].visualStatus;
  if (entry) return "draft";
  if (journeyStart && date < journeyStart) return "before_journey";
  return "untracked";
}

function buildDays(monthKey: string, today: string, entries: readonly CalendarEntry[], journeyStart: string | null) {
  const byDate = new Map(entries.map((entry) => [entry.date, entry]));
  return Array.from({ length: getDaysInMonth(monthKey) }, (_, index): CalendarDay => {
    const date = `${monthKey}-${String(index + 1).padStart(2, "0")}`;
    return {
      date,
      dayOfMonth: index + 1,
      state: getCalendarDayState(date, today, byDate.get(date), journeyStart),
      isToday: date === today,
    };
  });
}

/** Grille du mois en semaines lundi → dimanche ; `null` = case hors du mois. */
export function buildMonthGrid(
  monthKey: string,
  today: string,
  entries: readonly CalendarEntry[],
  journeyStart: string | null,
): (CalendarDay | null)[][] {
  const days = buildDays(monthKey, today, entries, journeyStart);
  const leading = getMondayBasedWeekday(`${monthKey}-01`);
  const cells: (CalendarDay | null)[] = [...Array<null>(leading).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}

export type PeriodSummary = SobrietyMetrics & {
  /** Journées passées (depuis le début du parcours) sans check-in terminé */
  untrackedDays: number;
};

/** Résumé d'une période : réutilise la définition unique des métriques (ADR-041). */
export function summarizeDays(days: readonly CalendarDay[], entries: readonly CalendarEntry[]): PeriodSummary {
  const dates = new Set(days.map((day) => day.date));
  const completed = entries.filter((entry) => entry.completed && dates.has(entry.date));
  return {
    ...calculateSobrietyMetrics(completed),
    untrackedDays: days.filter((day) => day.state === "untracked" || day.state === "draft").length,
  };
}

export type YearMonth = {
  monthKey: string;
  /** Cases vides avant le 1er (lundi = 0) */
  leading: number;
  days: CalendarDay[];
  summary: PeriodSummary;
};

/** Les 12 mois d'une année, chacun avec ses journées et son résumé. */
export function buildYear(
  year: number,
  today: string,
  entries: readonly CalendarEntry[],
  journeyStart: string | null,
): { months: YearMonth[]; summary: PeriodSummary } {
  const months = Array.from({ length: 12 }, (_, index): YearMonth => {
    const monthKey = `${String(year).padStart(4, "0")}-${String(index + 1).padStart(2, "0")}`;
    const days = buildDays(monthKey, today, entries, journeyStart);
    return {
      monthKey,
      leading: getMondayBasedWeekday(`${monthKey}-01`),
      days,
      summary: summarizeDays(days, entries),
    };
  });
  return { months, summary: summarizeDays(months.flatMap((month) => month.days), entries) };
}

/** Lien d'une journée : check-in terminé → détail ; aujourd'hui → check-in ; sinon aucun (V1). */
export function getCalendarDayHref(day: CalendarDay): string | null {
  if (day.state === "future" || day.state === "before_journey") return null;
  if (day.isToday && (day.state === "untracked" || day.state === "draft")) return routes.checkin;
  if (day.state === "draft" || day.state === "untracked") return null;
  return journalDayHref(day.date);
}

export function journalDayHref(date: string): string {
  return `${routes.journal}/${date}`;
}

export type CalendarParams = { view: CalendarView; monthKey: string; year: number };

/**
 * Paramètres d'URL du calendrier, validés et bornés : jamais au-delà du mois / de
 * l'année en cours, jamais avant 1900. Valeur invalide → mois / année en cours.
 */
export function parseCalendarParams(
  searchParams: Record<string, string | string[] | undefined>,
  today: string,
): CalendarParams {
  const currentMonth = getMonthKey(today);
  const currentYear = Number(today.slice(0, 4));
  const view: CalendarView = searchParams.view === "year" ? "year" : "month";

  const monthParam = searchParams.month;
  let monthKey = isValidMonthKey(monthParam) ? monthParam : currentMonth;
  if (monthKey > currentMonth) monthKey = currentMonth;

  const yearParam = typeof searchParams.year === "string" && /^\d{4}$/.test(searchParams.year) ? Number(searchParams.year) : NaN;
  const year = Number.isFinite(yearParam) && yearParam >= 1900 && yearParam <= currentYear ? yearParam : view === "year" ? currentYear : Number(monthKey.slice(0, 4));

  return { view, monthKey, year };
}

export function calendarMonthHref(monthKey: string): string {
  return `${routes.calendar}?view=month&month=${monthKey}`;
}

export function calendarYearHref(year: number): string {
  return `${routes.calendar}?view=year&year=${year}`;
}

/** Navigation mois précédent / suivant (pas au-delà du mois en cours). */
export function getMonthNavigation(monthKey: string, today: string) {
  const currentMonth = getMonthKey(today);
  const previous = addMonths(monthKey, -1);
  const next = addMonths(monthKey, 1);
  return {
    previous: previous >= "1900-01" ? previous : null,
    next: next <= currentMonth ? next : null,
    isCurrent: monthKey === currentMonth,
  };
}
