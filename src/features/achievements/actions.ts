"use server";

import { revalidatePath } from "next/cache";

import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/session";
import { awardAchievements, type AwardResult } from "@/lib/services/achievements";

/**
 * Rattrapage explicite des accomplissements (ADR-089) : déclenché par un clic (POST),
 * jamais par l'affichage ou le préchargement d'une page. Idempotent.
 */
export async function reconcileAchievementsAction(): Promise<AwardResult | null> {
  if (!(await getCurrentUser())) return null;
  const result = await awardAchievements();
  revalidatePath(routes.achievements);
  revalidatePath(routes.today);
  return result;
}
