/*
 * Protections de requête pour les opérations sensibles (export, suppression du compte).
 * Les Server Actions de Next.js vérifient déjà Origin / Host ; ces fonctions servent aux
 * Route Handlers et ajoutent une défense explicite pour la suppression.
 */

type HeaderReader = { get(name: string): string | null };

/**
 * Vrai si la requête provient de la même origine : l'en-tête Origin doit exister et
 * correspondre à l'hôte servi (X-Forwarded-Host derrière le proxy de l'hébergeur, sinon Host).
 */
export function isSameOriginRequest(headers: HeaderReader): boolean {
  const origin = headers.get("origin");
  const host = headers.get("x-forwarded-host")?.split(",")[0]?.trim() || headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Limite de fréquence simple, en mémoire (une instance Node) : empêche les doubles clics
 * et les rafales. Pas un dispositif anti-abus distribué (voir docs/SECURITY.md).
 */
export function createRateLimiter(windowMs: number, now: () => number = Date.now) {
  const lastByKey = new Map<string, number>();
  return {
    /** Vrai si l'appel est autorisé (et l'enregistre), faux s'il est trop rapproché. */
    take(key: string): boolean {
      const current = now();
      const last = lastByKey.get(key);
      if (last !== undefined && current - last < windowMs) return false;
      lastByKey.set(key, current);
      if (lastByKey.size > 10_000) {
        for (const [storedKey, time] of lastByKey) if (current - time >= windowMs) lastByKey.delete(storedKey);
      }
      return true;
    },
  };
}
