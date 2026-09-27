"use server";

import { randomUUID } from "node:crypto";

import { z } from "zod";

import { CRAVING_SAVE_ERROR } from "@/features/craving/constants";
import {
  completeCravingSchema,
  startCravingEventSchema,
  startInterventionSchema,
  timerActionSchema,
} from "@/features/craving/schemas";
import { getCurrentUser } from "@/lib/auth/session";
import { awardAchievements, type AwardResult } from "@/lib/services/achievements";
import {
  completeCravingEvent,
  dismissCravingEvent,
  getCravingEvent,
  startCravingEvent,
  startCravingIntervention,
  updateCravingTimer,
  type CravingWriteResult,
} from "@/lib/services/craving";

/*
 * Server Actions du mode envie. Identité issue de la session ; entrées revalidées
 * ici (Zod) puis par les RPC et les contraintes de la base. Aucun contenu saisi
 * n'est journalisé.
 */

export type CravingActionState =
  | { status: "ok"; achievements?: AwardResult }
  | { status: "error"; message: string };

const SESSION_EXPIRED = "Ta session a expiré. Reconnecte-toi pour continuer.";
const eventIdSchema = z.uuid();

function toState(result: CravingWriteResult): CravingActionState {
  if (result.ok) return { status: "ok" };
  if (result.reason === "not_found") return { status: "error", message: "Ce moment est introuvable." };
  if (result.reason === "not_in_progress") {
    return { status: "error", message: "Ce moment n'est plus en cours. Recharge la page pour le voir." };
  }
  return { status: "error", message: CRAVING_SAVE_ERROR };
}

/** Étape 1 : crée le moment (idempotent : `id` généré par le client). */
export async function startCravingEventAction(input: unknown): Promise<CravingActionState> {
  if (!(await getCurrentUser())) return { status: "error", message: SESSION_EXPIRED };
  const parsed = startCravingEventSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Certaines réponses sont incomplètes." };
  return toState(await startCravingEvent(parsed.data));
}

/** Étape 2 : stratégie + durée ; démarre l'intervention (idempotent). */
export async function startInterventionAction(eventId: unknown, input: unknown): Promise<CravingActionState> {
  if (!(await getCurrentUser())) return { status: "error", message: SESSION_EXPIRED };
  const id = eventIdSchema.safeParse(eventId);
  const parsed = startInterventionSchema.safeParse(input);
  if (!id.success || !parsed.success) return { status: "error", message: "Choisis une stratégie à essayer." };
  return toState(await startCravingIntervention(id.data, parsed.data));
}

export type TimerActionState =
  | { status: "ok"; timer: { startedAt: string; pausedAt: string | null; pausedSeconds: number; completedAt: string | null } }
  | { status: "error"; message: string };

/** Pause, reprise ou fin de l'intervention. */
export async function updateTimerAction(eventId: unknown, action: unknown): Promise<TimerActionState> {
  if (!(await getCurrentUser())) return { status: "error", message: SESSION_EXPIRED };
  const id = eventIdSchema.safeParse(eventId);
  const parsedAction = timerActionSchema.safeParse(action);
  if (!id.success || !parsedAction.success) return { status: "error", message: CRAVING_SAVE_ERROR };
  const result = await updateCravingTimer(id.data, parsedAction.data);
  if (!result.ok) return toState(result) as Extract<TimerActionState, { status: "error" }>;
  return { status: "ok", timer: result.timer };
}

/** Étape 4 : score final obligatoire ; termine le moment. */
export async function completeCravingEventAction(eventId: unknown, input: unknown): Promise<CravingActionState> {
  if (!(await getCurrentUser())) return { status: "error", message: SESSION_EXPIRED };
  const id = eventIdSchema.safeParse(eventId);
  const parsed = completeCravingSchema.safeParse(input);
  if (!id.success || !parsed.success) return { status: "error", message: "Indique à combien est ton envie maintenant." };
  const state = toState(await completeCravingEvent(id.data, parsed.data));
  // Point d'évaluation : moment terminé, quel que soit le résultat (8 → 9 compte aussi).
  return state.status === "ok" ? { status: "ok", achievements: await awardAchievements() } : state;
}

/** « Ne pas continuer ce moment » : il reste enregistré sans compter dans les analyses. */
export async function dismissCravingEventAction(eventId: unknown): Promise<CravingActionState> {
  if (!(await getCurrentUser())) return { status: "error", message: SESSION_EXPIRED };
  const id = eventIdSchema.safeParse(eventId);
  if (!id.success) return { status: "error", message: CRAVING_SAVE_ERROR };
  return toState(await dismissCravingEvent(id.data));
}

export type FollowUpState = { status: "ok"; eventId: string } | { status: "error"; message: string };

/**
 * « Essayer une autre stratégie » : nouveau moment qui reprend les substances,
 * émotions et déclencheurs du précédent, avec pour envie initiale son score final.
 * `newEventId` (généré par le client) rend le double clic sans effet.
 */
export async function startFollowUpCravingAction(previousEventId: unknown, newEventId: unknown): Promise<FollowUpState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: SESSION_EXPIRED };
  const previousId = eventIdSchema.safeParse(previousEventId);
  const nextId = eventIdSchema.safeParse(newEventId ?? randomUUID());
  if (!previousId.success || !nextId.success) return { status: "error", message: CRAVING_SAVE_ERROR };

  const previous = await getCravingEvent(user.id, previousId.data);
  if (!previous || previous.final === null) return { status: "error", message: "Ce moment est introuvable." };

  const payload = startCravingEventSchema.safeParse({
    id: nextId.data,
    initialCravingScore: previous.final,
    substanceIds: previous.substances.map((substance) => substance.id),
    emotions: previous.emotions.map((emotion) => emotion.slug),
    triggers: previous.triggers.map((trigger) => ({ slug: trigger.slug, customLabel: trigger.customLabel ?? undefined })),
    triggerUnknown: previous.triggerUnknown,
  });
  if (!payload.success) return { status: "error", message: CRAVING_SAVE_ERROR };

  const result = await startCravingEvent(payload.data);
  return result.ok ? { status: "ok", eventId: nextId.data } : (toState(result) as Extract<FollowUpState, { status: "error" }>);
}
