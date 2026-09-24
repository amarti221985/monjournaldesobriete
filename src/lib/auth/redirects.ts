import {
  guestOnlyRoutes,
  postAuthRedirectPrefixes,
  protectedRoutePrefixes,
  routes,
} from "@/config/routes";

/**
 * Règles de redirection liées à l'authentification — fonctions pures, testées.
 * Utilisées par le proxy, les Server Actions, le callback Auth et les layouts.
 */

const INTERNAL_ORIGIN = "http://internal.invalid";
const MAX_REDIRECT_LENGTH = 512;
// Caractères de contrôle et espaces : jamais légitimes dans une destination interne.
const FORBIDDEN_CHARACTERS = /[\u0000-\u001f\u007f\s\\]/;

export function isPathWithin(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Destination par défaut d'un utilisateur connecté.
 * Sprint 2 : dépendra de `profiles.onboarding_completed` (/onboarding ou /today).
 */
export function getAuthenticatedHomeRoute(): string {
  return routes.today;
}

/**
 * Retourne `value` uniquement s'il s'agit d'un chemin interne autorisé
 * (voir `postAuthRedirectPrefixes`), sinon `fallback`.
 * Refuse notamment : URL absolues, `//domaine`, `/\domaine`, `javascript:`,
 * caractères de contrôle et chemins hors liste blanche.
 */
export function getSafeRedirect(
  value: unknown,
  fallback: string = getAuthenticatedHomeRoute(),
): string {
  if (typeof value !== "string") return fallback;
  if (value.length === 0 || value.length > MAX_REDIRECT_LENGTH) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (FORBIDDEN_CHARACTERS.test(value)) return fallback;

  let url: URL;
  try {
    url = new URL(value, INTERNAL_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== INTERNAL_ORIGIN) return fallback;

  // Le chemin normalisé (/today/../login → /login) doit être dans la liste blanche.
  const isAllowed = postAuthRedirectPrefixes.some((prefix) =>
    isPathWithin(url.pathname, prefix),
  );
  if (!isAllowed) return fallback;

  return `${url.pathname}${url.search}${url.hash}`;
}

/** URL de connexion conservant une destination interne sûre. */
export function buildLoginUrl(next?: string): string {
  const safeNext = next ? getSafeRedirect(next, "") : "";
  return safeNext ? `${routes.login}?next=${encodeURIComponent(safeNext)}` : routes.login;
}

type ProxyRedirectInput = {
  pathname: string;
  search: string;
  isAuthenticated: boolean;
};

/**
 * Redirection à appliquer par le proxy selon l'état d'authentification,
 * ou `null` si la requête peut continuer.
 */
export function resolveProxyRedirect({
  pathname,
  search,
  isAuthenticated,
}: ProxyRedirectInput): string | null {
  const isProtected = protectedRoutePrefixes.some((prefix) => isPathWithin(pathname, prefix));
  if (!isAuthenticated && isProtected) {
    return buildLoginUrl(`${pathname}${search}`);
  }

  const isGuestOnly = guestOnlyRoutes.some((route) => isPathWithin(pathname, route));
  if (isAuthenticated && isGuestOnly) {
    return getAuthenticatedHomeRoute();
  }

  return null;
}
