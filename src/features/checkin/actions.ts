"use server";

import { z } from "zod";

import { CHECKIN_SAVE_ERROR } from "@/features/checkin/constants";
import { createCheckinPayloadSchema } from "@/features/checkin/schemas";
import { getCurrentUser } from "@/lib/auth/session";
import { getLatestAllowedLocalDate, getUserToday, isValidDateString } from "@/lib/dates";
import { discardCheckinDraft, saveCheckin } from "@/lib/services/checkins";
import { getCurrentProfile } from "@/lib/services/profiles";

/*
 * Server Actions du check-in. Identité issue de la session ; entrées revalidées
 * ici (Zod) puis par la RPC et les contraintes de la base.
 */

export type SaveCheckinState =
  | { status: "saved" }
  | { status: "completed" }
  | { status: "error"; message: string };

async function saveWith(input: unknown, finalize: boolean): Promise<SaveCheckinState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Ta session a expiré. Reconnecte-toi pour continuer." };

  const profile = await getCurrentProfile();
  const schema = createCheckinPayloadSchema({
    latestAllowedDate: getLatestAllowedLocalDate(profile?.timezone),
    finalize,
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Certaines réponses sont incomplètes. Utilise « Modifier » pour les vérifier.",
    };
  }

  const result = await saveCheckin(parsed.data, finalize);
  if (result.status === "error") return { status: "error", message: CHECKIN_SAVE_ERROR };
  if (result.status === "already_completed") {
    // Brouillon envoyé pour un check-in déjà terminé (ex. autre onglet) : rien n'est écrasé.
    return { status: "error", message: "Ce check-in est déjà terminé. Recharge la page pour le voir." };
  }
  return { status: finalize ? "completed" : "saved" };
}

/** Sauvegarde du brouillon à chaque changement d'étape (jamais un check-in terminé). */
export async function saveCheckinDraftAction(input: unknown): Promise<SaveCheckinState> {
  return saveWith(input, false);
}

/** Finalisation (création ou modification) : transactionnelle et idempotente. */
export async function completeCheckinAction(input: unknown): Promise<SaveCheckinState> {
  return saveWith(input, true);
}

/** « Recommencer » : supprime le brouillon du jour. */
export async function discardCheckinDraftAction(checkinDate: unknown): Promise<boolean> {
  const date = z.string().refine(isValidDateString).safeParse(checkinDate);
  if (!date.success) return false;

  const user = await getCurrentUser();
  if (!user) return false;
  const profile = await getCurrentProfile();
  // Sprint 3 : seul le brouillon du jour peut être abandonné depuis l'interface.
  if (date.data !== getUserToday(profile?.timezone)) return false;

  return discardCheckinDraft(user.id, date.data);
}
