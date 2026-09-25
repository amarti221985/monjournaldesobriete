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
