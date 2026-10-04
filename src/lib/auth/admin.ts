import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { routes } from "@/config/routes";
import { requireUser, type CurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/*
 * Autorisation admin (ADR-099) : la table admin_users n'est lisible par aucun client ; le rôle
 * est vérifié par la fonction SQL is_admin() (auth.uid()), jamais par un courriel, un champ du
 * profil ni un état du navigateur. Chaque RPC admin revérifie le rôle côté base.
 */

/** Vrai si l'utilisateur connecté est administrateur (une requête par rendu). */
export const getIsAdmin = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_admin");
  if (error) {
    console.error("[admin] Vérification du rôle impossible", { code: error.code });
    return false;
  }
  return data === true;
});

/**
 * Page, layout ou Server Action admin : session obligatoire (sinon /login), puis rôle admin
 * (sinon retour à l'espace personnel, sans révéler l'administration).
 */
export async function requireAdmin(nextPath: string = routes.admin): Promise<CurrentUser> {
  const user = await requireUser(nextPath);
  if (!(await getIsAdmin())) redirect(routes.today);
  return user;
}
