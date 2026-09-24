import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { buildLoginUrl } from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string | null;
};

/**
 * Utilisateur authentifié de la requête courante, ou `null`.
 *
 * `getClaims()` vérifie la signature du JWT (localement avec les clés asymétriques,
 * sinon auprès du serveur Auth) : on ne fait jamais confiance au contenu brut
 * des cookies. Mémorisé pour la durée d'un rendu (React `cache`).
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;

  return {
    id: data.claims.sub,
    email: typeof data.claims.email === "string" ? data.claims.email : null,
  };
});

/**
 * Exige un utilisateur connecté (layouts, pages, Server Actions de la zone protégée).
 * Redirige vers la connexion sinon, en conservant une destination interne sûre.
 */
export async function requireUser(nextPath?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(buildLoginUrl(nextPath));
  return user;
}
