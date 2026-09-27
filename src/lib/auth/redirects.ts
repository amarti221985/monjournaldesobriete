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

/** État d'onboarding nécessaire aux décisions de routage (issu de `profiles`). */
export type OnboardingState = { onboarding_completed: boolean } | null;

/**
 * Destination par défaut d'un utilisateur connecté (ADR-025) :
 * `/onboarding` tant que l'onboarding n'est pas terminé, sinon `/today`.
 * Sans profil fourni (ex. proxy), `/today` : son layout redirige si nécessaire.
 */
export function getAuthenticatedHomeRoute(profile?: OnboardingState): string {
  if (profile !== undefined && !profile?.onboarding_completed) return routes.onboarding;
  return routes.today;
}

/** Après connexion : onboarding si incomplet, sinon destination demandée (sûre) ou /today. */
export function resolvePostLoginRedirect(profile: OnboardingState, next: unknown): string {
  return profile?.onboarding_completed ? getSafeRedirect(next) : routes.onboarding;
}

/** Zone applicative : redirection vers l'onboarding s'il n'est pas terminé, sinon null. */
export function getAppAccessRedirect(profile: OnboardingState): string | null {
  return profile?.onboarding_completed ? null : routes.onboarding;
}

/** Page d'onboarding : un onboarding terminé ne peut pas être refait (évite d'écraser les données). */
export function getOnboardingAccessRedirect(profile: OnboardingState): string | null {
  return profile?.onboarding_completed ? routes.today : null;
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
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]);

/**
 * Origine des redirections absolues d'un Route Handler. Derrière l'hébergeur, `request.url`
 * peut contenir l'adresse interne du serveur (ex. https://0.0.0.0:3000) : on utilise l'URL
 * publique configurée (NEXT_PUBLIC_SITE_URL) dès qu'elle n'est pas locale ; sinon (dev),
 * l'origine de la requête.
 */
export function resolveRedirectOrigin(requestUrl: string, siteUrl: URL | null): string {
  if (siteUrl && !LOCAL_HOSTNAMES.has(siteUrl.hostname)) return siteUrl.origin;
  return new URL(requestUrl).origin;
}

export function buildLoginUrl(next?: string): string {
  const safeNext = next ? getSafeRedirect(next, "") : "";
  return safeNext ? `${routes.login}?next=${encodeURIComponent(safeNext)}` : routes.login;
}

type ProxyRedirectInput = {
  pathname: string;
  search: string;
  isAuthenticated: boolean;
  /** État de l'onboarding, lu par le proxy seulement si nécessaire (sinon `undefined`). */
  onboardingCompleted?: boolean;
};

function isProtectedPath(pathname: string) {
  return protectedRoutePrefixes.some((prefix) => isPathWithin(pathname, prefix));
}

function isGuestOnlyPath(pathname: string) {
  return guestOnlyRoutes.some((route) => isPathWithin(pathname, route));
}

/** Vrai si le proxy doit connaître l'état de l'onboarding pour ce chemin. */
export function needsOnboardingState(pathname: string): boolean {
  return isProtectedPath(pathname) || isGuestOnlyPath(pathname);
}

/**
 * Redirection à appliquer par le proxy selon l'authentification et l'onboarding,
 * ou `null` si la requête peut continuer. Les layouts revérifient côté serveur.
 */
export function resolveProxyRedirect({
  pathname,
  search,
  isAuthenticated,
  onboardingCompleted,
}: ProxyRedirectInput): string | null {
  if (!isAuthenticated) {
    return isProtectedPath(pathname) ? buildLoginUrl(`${pathname}${search}`) : null;
  }

  const onboardingState =
    onboardingCompleted === undefined ? undefined : { onboarding_completed: onboardingCompleted };

  if (isGuestOnlyPath(pathname)) return getAuthenticatedHomeRoute(onboardingState);
  if (onboardingState === undefined) return null;
  if (isPathWithin(pathname, routes.onboarding)) return getOnboardingAccessRedirect(onboardingState);
  if (isProtectedPath(pathname)) return getAppAccessRedirect(onboardingState);
  return null;
}
