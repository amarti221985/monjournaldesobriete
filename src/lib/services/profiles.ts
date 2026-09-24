import "server-only";

import { cache } from "react";

import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isValidTimeZone } from "@/lib/timezone";
import type { Tables } from "@/types/database";

export type Profile = Pick<
  Tables<"profiles">,
  "id" | "display_name" | "timezone" | "onboarding_completed"
>;

const PROFILE_COLUMNS = "id, display_name, timezone, onboarding_completed";

/**
 * Profil de l'utilisateur connecté, ou `null` si personne n'est connecté.
 * La RLS garantit qu'aucun autre profil ne peut être lu.
 * Mémorisé pour la durée d'un rendu : plusieurs composants peuvent l'appeler
 * sans multiplier les requêtes.
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    // Code technique uniquement : jamais le contenu du profil.
    console.error("[profiles] Lecture du profil impossible", { code: error.code });
    throw new Error("Le profil n'a pas pu être chargé.");
  }
  return data;
});

/**
 * Enregistre le fuseau détecté par le navigateur si le profil n'en a pas encore.
 * Ne remplace jamais un fuseau déjà choisi.
 */
export async function saveTimezoneIfMissing(userId: string, timezone: string): Promise<boolean> {
  if (!isValidTimeZone(timezone)) return false;

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ timezone })
    .eq("id", userId)
    .is("timezone", null);

  if (error) {
    console.error("[profiles] Enregistrement du fuseau impossible", { code: error.code });
    return false;
  }
  return true;
}
