import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Client Supabase pour les Server Components, Server Actions et Route Handlers.
 *
 * Créer un nouveau client à chaque requête : ne jamais le partager dans une
 * variable globale (la session dépend des cookies de la requête courante).
 *
 * Pour identifier l'utilisateur côté serveur, utiliser `supabase.auth.getClaims()`
 * ou `supabase.auth.getUser()` (validés par Supabase), jamais `getSession()`
 * seul, dont le contenu provient des cookies sans vérification.
 */
export async function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Appelé depuis un Server Component : les cookies y sont en lecture seule.
          // Le rafraîchissement de session sera assuré par le proxy (Sprint 1).
        }
      },
    },
  });
}
