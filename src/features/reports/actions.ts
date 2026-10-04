"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { recordProductEvent } from "@/lib/services/product-events";

/**
 * Mesure produit (Admin V1) : clic sur « Imprimer / Enregistrer en PDF ». On ne peut pas savoir
 * si un fichier a réellement été enregistré : la métrique s'appelle « rapports PDF lancés ».
 */
export async function recordPdfReportLaunchAction(): Promise<void> {
  if (!(await getCurrentUser())) return;
  await recordProductEvent("pdf_report_launched");
}
