import type { ProgressCheckin } from "@/features/progress/types";
import { addDays, daysBetween, formatLocalDate } from "@/lib/dates";

/*
 * Périodes de la progression et du journal (ADR-052) : des JOURNÉES CALENDAIRES
 * locales (fuseau du profil), jamais « les N derniers check-ins » ni
 * `Date.now() - N × 24 h`. « 30 jours » = aujourd'hui + les 29 journées précédentes,
 * que l'utilisateur ait fait un check-in ces jours-là ou non. Les calculs portent sur
 * des chaînes YYYY-MM-DD : un changement d'heure ne déplace aucune borne.
 */

export const PERIOD_FILTERS = ["7d", "30d", "90d", "year", "all"] as const;
export type PeriodFilter = (typeof PERIOD_FILTERS)[number];

/** Périodes de la page Progression (mêmes clés que les filtres du journal). */
export type ProgressPeriod = PeriodFilter;
export const DEFAULT_PROGRESS_PERIOD: ProgressPeriod = "30d";

/** Périodes glissantes de longueur fixe : les seules comparées à la période précédente. */
const ROLLING_PERIOD_DAYS: Partial<Record<ProgressPeriod, number>> = { "7d": 7, "30d": 30, "90d": 90 };

export const progressPeriodLabels: Record<ProgressPeriod, string> = {
  "7d": "7 jours",
  "30d": "30 jours",
  "90d": "90 jours",
  year: "Cette année",
  all: "Tout",
};

/** Plage de journées locales, bornes incluses. */
export type DateRange = { start: string; end: string };

/**
 * Première journée incluse d'une période (aujourd'hui inclus) ; null pour « Tout ».
 * « Cette année » : du 1er janvier local jusqu'à aujourd'hui.
 */
export function getPeriodStart(period: PeriodFilter, today: string): string | null {
  const rollingDays = ROLLING_PERIOD_DAYS[period];
  if (rollingDays) return addDays(today, -(rollingDays - 1));
  if (period === "year") return `${today.slice(0, 4)}-01-01`;
  return null;
}

/** Période lue depuis l'URL (?period=) ; toute valeur inconnue → 30 jours. */
export function parseProgressPeriod(value: unknown): ProgressPeriod {
  return PERIOD_FILTERS.find((period) => period === value) ?? DEFAULT_PROGRESS_PERIOD;
}

/**
 * Plage de la période. Pour « Tout », elle commence à la première journée enregistrée
 * (ou aujourd'hui s'il n'y en a aucune).
 */
export function getPeriodRange(period: ProgressPeriod, today: string, firstDate: string | null): DateRange {
  const start = getPeriodStart(period, today) ?? (firstDate && firstDate < today ? firstDate : today);
  return { start, end: today };
}

/**
 * Période précédente équivalente, sans chevauchement : pour 30 jours, les 30 journées
 * qui se terminent la veille du début de la période actuelle. null pour « Cette année »
 * et « Tout » (pas de comparaison).
 */
export function getPreviousPeriodRange(period: ProgressPeriod, today: string): DateRange | null {
  const rollingDays = ROLLING_PERIOD_DAYS[period];
  if (!rollingDays) return null;
  const currentStart = addDays(today, -(rollingDays - 1));
  return { start: addDays(currentStart, -rollingDays), end: addDays(currentStart, -1) };
}

export function isComparablePeriod(period: ProgressPeriod): boolean {
  return ROLLING_PERIOD_DAYS[period] !== undefined;
}

/** Nombre de journées calendaires d'une plage (bornes incluses). */
export function countRangeDays(range: DateRange): number {
  return daysBetween(range.start, range.end) + 1;
}

export function isInRange(date: string, range: DateRange): boolean {
  return date >= range.start && date <= range.end;
}

export function filterCheckinsInRange(checkins: readonly ProgressCheckin[], range: DateRange): ProgressCheckin[] {
  return checkins.filter((checkin) => isInRange(checkin.date, range));
}

/** « du 26 août au 24 septembre 2026 » */
export function formatRange(range: DateRange): string {
  const sameYear = range.start.slice(0, 4) === range.end.slice(0, 4);
  const start = formatLocalDate(range.start, sameYear ? { day: "numeric", month: "long" } : { dateStyle: "long" });
  const end = formatLocalDate(range.end, { dateStyle: "long" });
  return range.start === range.end ? `le ${end}` : `du ${start} au ${end}`;
}
