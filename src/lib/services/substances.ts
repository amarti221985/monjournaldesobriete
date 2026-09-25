import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type CatalogueSubstance = Pick<Tables<"substances">, "slug" | "name_fr" | "category">;

/** Catalogue global des substances actives, dans l'ordre d'affichage (lecture seule). */
export const getActiveSubstances = cache(async (): Promise<CatalogueSubstance[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("substances")
    .select("slug, name_fr, category")
    .eq("is_active", true)
    .order("sort_order");

  if (error) {
    console.error("[substances] Lecture du catalogue impossible", { code: error.code });
    throw new Error("Le catalogue n'a pas pu être chargé.");
  }
  return data;
});
