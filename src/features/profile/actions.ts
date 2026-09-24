"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { saveTimezoneIfMissing } from "@/lib/services/profiles";
import { isValidTimeZone } from "@/lib/timezone";

/**
 * Enregistre le fuseau détecté par le navigateur si le profil n'en a pas.
 * Silencieux en cas d'échec : ne doit jamais bloquer l'accès à l'application.
 */
export async function saveDetectedTimezoneAction(timezone: unknown): Promise<void> {
  if (!isValidTimeZone(timezone)) return;
  const user = await getCurrentUser();
  if (!user) return;
  await saveTimezoneIfMissing(user.id, timezone);
}
