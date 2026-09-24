import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Client Supabase pour les Client Components ("use client").
 *
 * La session est stockée dans des cookies (géré par @supabase/ssr), ce qui
 * permet aux Server Components de lire la même session.
 * Utilise uniquement la clé publiable : toutes les données restent protégées
 * par les politiques RLS côté base.
 */
export function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  return createBrowserClient<Database>(url, publishableKey);
}
