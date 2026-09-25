import { siteConfig } from "@/config/site";
import { isValidTimeZone } from "@/lib/timezone";

/**
 * Dates métier « journée locale » (ADR-006, ADR-027) au format ISO `YYYY-MM-DD`.
 * Une journée locale n'est jamais convertie en UTC.
 */

const ISO_DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
export const MIN_JOURNEY_DATE = "1900-01-01";

/**
 * Fuseau le plus en avance sur le calendrier (UTC+14). Utilisé lorsque le fuseau de
 * l'utilisateur est inconnu, pour ne jamais refuser à tort la date « d'aujourd'hui ».
 * Même règle dans public.complete_onboarding().
 */
export const LATEST_TIME_ZONE = "Pacific/Kiritimati";

/** Vrai si `value` est une date calendaire réelle au format YYYY-MM-DD. */
export function isValidDateString(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_FORMAT.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Journée locale (YYYY-MM-DD) à l'instant `now` dans le fuseau donné. */
export function getLocalDateString(timeZone: string, now: Date = new Date()): string {
  // en-CA formate nativement en AAAA-MM-JJ.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Date la plus tardive acceptée comme début de parcours : aujourd'hui dans le fuseau
 * de l'utilisateur, ou dans le fuseau le plus en avance s'il est inconnu.
 */
export function getLatestAllowedLocalDate(
  timeZone: string | null | undefined,
  now: Date = new Date(),
): string {
  return getLocalDateString(isValidTimeZone(timeZone) ? timeZone : LATEST_TIME_ZONE, now);
}

/** Vrai si `date` est postérieure à `today` (comparaison de dates ISO). */
export function isAfterDate(date: string, today: string): boolean {
  return date > today;
}

/** « 24 septembre 2026 » — formatage d'une journée locale, sans conversion de fuseau. */
export function formatLongDate(date: string): string {
  return new Intl.DateTimeFormat("fr-CA", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

/**
 * « Aujourd'hui » pour l'utilisateur (ADR-034) : journée locale dans le fuseau de son
 * profil, jamais `new Date().toISOString().slice(0, 10)` (qui donne la date UTC).
 * Sans fuseau valide : fuseau par défaut de l'application.
 */
export function getUserToday(timeZone: string | null | undefined, now: Date = new Date()): string {
  return getLocalDateString(isValidTimeZone(timeZone) ? timeZone : siteConfig.defaultTimeZone, now);
}

/** « jeudi 24 septembre 2026 » — journée locale, sans conversion de fuseau. */
export function formatWeekdayDate(date: string): string {
  return new Intl.DateTimeFormat("fr-CA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

const DAY_MS = 86_400_000;

/** Journée locale décalée de `days` jours (calcul calendaire, sans fuseau). */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Jour de la semaine d'une journée locale : 0 = lundi … 6 = dimanche (ADR-044). */
export function getMondayBasedWeekday(date: string): number {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
}

/** Lundi de la semaine contenant `date` (semaine commençant le lundi). */
export function getWeekStart(date: string): string {
  return addDays(date, -getMondayBasedWeekday(date));
}

/** Nombre de jours entre deux journées locales (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

/** Formatage court d'une journée locale, ex. options { weekday: "short" } → « jeu. ». */
export function formatLocalDate(date: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("fr-CA", { ...options, timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

/*
 * Mois métier « YYYY-MM » (calendrier). Calculs calendaires purs, sans fuseau :
 * « aujourd'hui » vient toujours de getUserToday(profiles.timezone).
 */

const MONTH_KEY_FORMAT = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidMonthKey(value: unknown): value is string {
  return typeof value === "string" && MONTH_KEY_FORMAT.test(value) && value >= "1900-01";
}

/** « 2026-09-24 » → « 2026-09 ». */
export function getMonthKey(date: string): string {
  return date.slice(0, 7);
}

/** Mois décalé de `months` mois : addMonths("2026-01", -1) → « 2025-12 ». */
export function addMonths(monthKey: string, months: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const index = year * 12 + (month - 1) + months;
  return `${String(Math.floor(index / 12)).padStart(4, "0")}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export function getDaysInMonth(monthKey: string): number {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Premier et dernier jour d'un mois (bornes inclusives). */
export function getMonthRange(monthKey: string): { start: string; end: string } {
  return { start: `${monthKey}-01`, end: `${monthKey}-${String(getDaysInMonth(monthKey)).padStart(2, "0")}` };
}

/** « septembre 2026 » */
export function formatMonthYear(monthKey: string): string {
  return formatLocalDate(`${monthKey}-01`, { month: "long", year: "numeric" });
}

/** Libellé court et sûr pour l'URL d'une journée : « /journal/2026-09-24 ». */
export function toDateSegment(date: string): string {
  if (!isValidDateString(date)) throw new Error("Date invalide.");
  return date;
}
