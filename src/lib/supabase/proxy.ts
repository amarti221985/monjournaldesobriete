import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Rafraîchit la session Supabase pour la requête courante (appelé par src/proxy.ts).
 *
 * Approche officielle @supabase/ssr : les cookies rafraîchis sont écrits à la fois
 * sur la requête (pour le rendu serveur qui suit) et sur la réponse (pour le
 * navigateur). `getClaims()` valide le JWT et déclenche le rafraîchissement si
 * nécessaire — ne rien exécuter entre la création du client et cet appel.
 */
export async function updateSession(request: NextRequest) {
  const { url, publishableKey } = getSupabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        // En-têtes anti-cache fournis par @supabase/ssr lorsqu'une session est écrite.
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();

  return { response, isAuthenticated: Boolean(data?.claims?.sub) };
}

/**
 * Crée une redirection en conservant les cookies de session rafraîchis
 * (sinon l'utilisateur pourrait être déconnecté par erreur).
 */
export function redirectWithSession(
  request: NextRequest,
  sessionResponse: NextResponse,
  destination: string,
) {
  const redirect = NextResponse.redirect(new URL(destination, request.url));
  sessionResponse.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  const cacheControl = sessionResponse.headers.get("Cache-Control");
  if (cacheControl) redirect.headers.set("Cache-Control", cacheControl);
  return redirect;
}
