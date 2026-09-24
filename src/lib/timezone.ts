/**
 * Fuseaux horaires IANA (ex. America/Toronto) — ADR-019.
 * On ne stocke jamais un décalage fixe (UTC-4) : il ne suit pas les changements d'heure.
 */

const IANA_TIMEZONE_FORMAT = /^[A-Za-z0-9_+-]+(\/[A-Za-z0-9_+-]+)*$/;
const MAX_TIMEZONE_LENGTH = 64;

/** Vrai si `value` est un identifiant de fuseau IANA reconnu par le runtime. */
export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > MAX_TIMEZONE_LENGTH) return false;
  if (!IANA_TIMEZONE_FORMAT.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Fuseau détecté par le navigateur, ou `null` si indisponible ou invalide. */
export function detectBrowserTimeZone(): string | null {
  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZone(detected) ? detected : null;
  } catch {
    return null;
  }
}
