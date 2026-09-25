import { NextResponse, type NextRequest } from "next/server";

import { needsOnboardingState, resolveProxyRedirect } from "@/lib/auth/redirects";
import { EnvValidationError } from "@/lib/env";
import { redirectWithSession, updateSession } from "@/lib/supabase/proxy";

/**
 * Proxy Next.js 16 (anciennement middleware) :
 * 1. rafraîchit la session Supabase à chaque navigation;
 * 2. redirige selon l'authentification et l'onboarding (première ligne de défense) ;
 *    l'état de l'onboarding n'est lu que pour les routes qui en dépendent.
 *
 * La protection réelle reste côté serveur : chaque layout / page / Server Action
 * de la zone (app) revérifie l'utilisateur (voir src/lib/auth/session.ts).
 */
export async function proxy(request: NextRequest) {
  let session: Awaited<ReturnType<typeof updateSession>>;
  try {
    session = await updateSession(request);
  } catch (error) {
    if (error instanceof EnvValidationError) {
      // Supabase non configuré : les pages publiques restent accessibles ; les pages
      // protégées afficheront une erreur explicite lors de leur propre vérification.
      console.error("[proxy] Configuration Supabase manquante :", error.message);
      return NextResponse.next({ request });
    }
    throw error;
  }

  const { pathname, search } = request.nextUrl;
  const onboardingCompleted =
    session.isAuthenticated && needsOnboardingState(pathname)
      ? await session.getOnboardingCompleted()
      : undefined;

  const destination = resolveProxyRedirect({
    pathname,
    search,
    isAuthenticated: session.isAuthenticated,
    onboardingCompleted,
  });

  return destination
    ? redirectWithSession(request, session.response, destination)
    : session.response;
}

export const config = {
  matcher: [
    // Toutes les routes sauf les fichiers statiques, images et icônes.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)",
  ],
};
