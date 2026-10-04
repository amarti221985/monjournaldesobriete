import "server-only";

import { createClient } from "@/lib/supabase/server";

/*
 * Événements produit (Admin V1) : seulement ce que les tables existantes ne mesurent pas.
 * Liste fermée, aucune métadonnée, une ligne par jour et par événement (record_product_event).
 * Ne lève jamais d'erreur : la mesure ne doit jamais gêner l'action de la personne.
 */

export type ProductEventName = "plan_updated" | "pdf_report_launched";

export async function recordProductEvent(event: ProductEventName): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("record_product_event", { p_event: event });
    if (error) console.error("[events] Enregistrement impossible", { code: error.code });
  } catch {
    console.error("[events] Enregistrement impossible", { code: "exception" });
  }
}
