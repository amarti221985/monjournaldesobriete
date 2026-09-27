"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { routes } from "@/config/routes";
import { MAX_PLAN_FAVORITES, MAX_SUPPORT_CONTACTS, PLAN_SAVE_ERROR } from "@/features/plan/constants";
import {
  createAddSubstanceSchema,
  createUpdateSubstanceSchema,
  favoriteSchema,
  letterSchema,
  personalStrategySchema,
  personalTriggerNotesSchema,
  personalTriggerSchema,
  planContactSchema,
  planIdSchema,
  planMotivationsSchema,
  planReasonSchema,
  reminderSchema,
  safePlaceSchema,
  updatePersonalStrategySchema,
  updatePlanContactSchema,
  updateSafePlaceSchema,
} from "@/features/plan/schemas";
import { getCurrentUser } from "@/lib/auth/session";
import { awardAchievements, type AwardResult } from "@/lib/services/achievements";
import { getLatestAllowedLocalDate } from "@/lib/dates";
import {
  addPersonalStrategy,
  addPersonalTrigger,
  addSafePlace,
  addSupportContact,
  addUserSubstance,
  countSupportContacts,
  deactivateUserSubstance,
  deleteLetter,
  deletePlanItem,
  deleteReminder,
  saveLetter,
  saveMotivations,
  saveReason,
  saveReminder,
  setFavorite,
  setPrimaryContact,
  setPrimarySubstance,
  updatePersonalStrategy,
  updatePersonalTriggerNotes,
  updateSafePlace,
  updateSupportContact,
  updateUserSubstance,
  type PlanWriteResult,
} from "@/lib/services/plan";
import { getCurrentProfile } from "@/lib/services/profiles";

/*
 * Server Actions de « Mon plan » : une par section (sauvegarde indépendante).
 * Identité issue de la session ; entrées revalidées (Zod) puis par la base.
 * Un identifiant d'un autre compte n'est jamais trouvé (filtre user_id + RLS).
 * Aucun contenu saisi n'est journalisé.
 */

export type PlanActionState = { status: "ok"; achievements?: AwardResult } | { status: "error"; message: string };

const SESSION_EXPIRED = "Ta session a expiré. Reconnecte-toi pour continuer.";
const INVALID = "Certaines informations sont incomplètes ou trop longues.";

async function requireUserId(): Promise<string | null> {
  return (await getCurrentUser())?.id ?? null;
}

async function done(
  result: PlanWriteResult,
  messages: Partial<Record<Exclude<PlanWriteResult, { ok: true }>["reason"], string>> = {},
): Promise<PlanActionState> {
  if (result.ok) {
    revalidatePath(routes.plan);
    revalidatePath(routes.craving, "layout");
    // Point d'évaluation : modification du plan (idempotent).
    return { status: "ok", achievements: await awardAchievements() };
  }
  const defaults = {
    not_found: "Cet élément est introuvable. Recharge la page.",
    duplicate: "Cet élément fait déjà partie de ton plan.",
    too_many_favorites: `Tu peux garder ${MAX_PLAN_FAVORITES} favoris au maximum. Retire un favori pour en choisir un autre.`,
    primary_substance: "Choisis d'abord une autre substance principale.",
    last_substance: "Ton plan doit garder au moins une substance suivie.",
    error: PLAN_SAVE_ERROR,
  } as const;
  return { status: "error", message: messages[result.reason] ?? defaults[result.reason] };
}

async function latestAllowedDate() {
  return getLatestAllowedLocalDate((await getCurrentProfile())?.timezone);
}

// --- Mon parcours ------------------------------------------------------------------

export async function updateSubstanceAction(input: unknown): Promise<PlanActionState> {
  const userId = await requireUserId();
  if (!userId) return { status: "error", message: SESSION_EXPIRED };
  const parsed = createUpdateSubstanceSchema(await latestAllowedDate()).safeParse(input);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? INVALID };
  return done(await updateUserSubstance(userId, parsed.data));
}

export async function addSubstanceAction(input: unknown): Promise<PlanActionState> {
  if (!(await requireUserId())) return { status: "error", message: SESSION_EXPIRED };
  const parsed = createAddSubstanceSchema(await latestAllowedDate()).safeParse(input);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? INVALID };
  return done(await addUserSubstance(parsed.data), { duplicate: "Tu suis déjà cette substance." });
}

export async function setPrimarySubstanceAction(id: unknown): Promise<PlanActionState> {
  if (!(await requireUserId())) return { status: "error", message: SESSION_EXPIRED };
  const parsed = planIdSchema.safeParse(id);
  if (!parsed.success) return { status: "error", message: PLAN_SAVE_ERROR };
  return done(await setPrimarySubstance(parsed.data));
}

export async function deactivateSubstanceAction(id: unknown): Promise<PlanActionState> {
  if (!(await requireUserId())) return { status: "error", message: SESSION_EXPIRED };
  const parsed = planIdSchema.safeParse(id);
  if (!parsed.success) return { status: "error", message: PLAN_SAVE_ERROR };
  return done(await deactivateUserSubstance(parsed.data));
}

// --- Raison et motivations ----------------------------------------------------------

export async function saveReasonAction(input: unknown): Promise<PlanActionState> {
  const userId = await requireUserId();
  if (!userId) return { status: "error", message: SESSION_EXPIRED };
  const parsed = planReasonSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? INVALID };
  return done(await saveReason(userId, parsed.data.reason));
}

export async function saveMotivationsAction(input: unknown): Promise<PlanActionState> {
  if (!(await requireUserId())) return { status: "error", message: SESSION_EXPIRED };
  const parsed = planMotivationsSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? INVALID };
  return done(await saveMotivations(parsed.data));
}

// --- Déclencheurs personnels --------------------------------------------------------

export async function addTriggerAction(input: unknown): Promise<PlanActionState> {
  const userId = await requireUserId();
  if (!userId) return { status: "error", message: SESSION_EXPIRED };
  const parsed = personalTriggerSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? INVALID };
  return done(await addPersonalTrigger(userId, parsed.data), { duplicate: "Ce déclencheur fait déjà partie de ton plan." });
}

export async function updateTriggerNotesAction(input: unknown): Promise<PlanActionState> {
  const userId = await requireUserId();
  if (!userId) return { status: "error", message: SESSION_EXPIRED };
  const parsed = personalTriggerNotesSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: INVALID };
  return done(await updatePersonalTriggerNotes(userId, parsed.data.id, parsed.data.notes));
}

// --- Stratégies personnelles --------------------------------------------------------

export async function addStrategyAction(input: unknown): Promise<PlanActionState> {
  const userId = await requireUserId();
  if (!userId) return { status: "error", message: SESSION_EXPIRED };
  const parsed = personalStrategySchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? INVALID };
  return done(await addPersonalStrategy(userId, parsed.data), { duplicate: "Cette stratégie fait déjà partie de ton plan." });
}

export async function updateStrategyAction(input: unknown): Promise<PlanActionState> {
  const userId = await requireUserId();
  if (!userId) return { status: "error", message: SESSION_EXPIRED };
  const parsed = updatePersonalStrategySchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: INVALID };
  return done(await updatePersonalStrategy(userId, parsed.data));
}

const favoriteTableSchema = z.enum(["strategy", "place"]);

/** Favori (stratégie ou lieu) : 3 au maximum, appliqué par la base. */
export async function setFavoriteAction(kind: unknown, input: unknown): Promise<PlanActionState> {
  const userId = await requireUserId();
  if (!userId) return { status: "error", message: SESSION_EXPIRED };
  const table = favoriteTableSchema.safeParse(kind);
  const parsed = favoriteSchema.safeParse(input);
  if (!table.success || !parsed.success) return { status: "error", message: PLAN_SAVE_ERROR };
  return done(
    await setFavorite(userId, table.data === "strategy" ? "user_personal_strategies" : "safe_places", parsed.data.id, parsed.data.favorite),
  );
}

const deletableSchema = z.enum(["trigger", "strategy", "place", "contact"]);
const DELETE_TABLES = {
  trigger: "user_personal_triggers",
  strategy: "user_personal_strategies",
  place: "safe_places",
  contact: "support_contacts",
} as const;

/**
 * Suppression après confirmation : éléments purement personnels, jamais référencés
 * par l'historique (les interventions copient la stratégie ; aucun lien vers un contact).
 */
export async function deletePlanItemAction(kind: unknown, id: unknown): Promise<PlanActionState> {
  const userId = await requireUserId();
  if (!userId) return { status: "error", message: SESSION_EXPIRED };
  const table = deletableSchema.safeParse(kind);
  const parsedId = planIdSchema.safeParse(id);
  if (!table.success || !parsedId.success) return { status: "error", message: PLAN_SAVE_ERROR };
  return done(await deletePlanItem(userId, DELETE_TABLES[table.data], parsedId.data));
}

// --- Personnes de soutien -----------------------------------------------------------

export async function addContactAction(input: unknown): Promise<PlanActionState> {
  const userId = await requireUserId();
  if (!userId) return { status: "error", message: SESSION_EXPIRED };
  const parsed = planContactSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? INVALID };
  if ((await countSupportContacts(userId)) >= MAX_SUPPORT_CONTACTS) {
    return { status: "error", message: `Tu peux garder ${MAX_SUPPORT_CONTACTS} personnes de soutien au maximum.` };
  }
  return done(await addSupportContact(userId, parsed.data));
}

export async function updateContactAction(input: unknown): Promise<PlanActionState> {
  const userId = await requireUserId();
  if (!userId) return { status: "error", message: SESSION_EXPIRED };
  const parsed = updatePlanContactSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? INVALID };
  const { id, ...contact } = parsed.data;
  return done(await updateSupportContact(userId, id, contact));
}

export async function setPrimaryContactAction(id: unknown): Promise<PlanActionState> {
  if (!(await requireUserId())) return { status: "error", message: SESSION_EXPIRED };
  const parsed = planIdSchema.nullable().safeParse(id);
  if (!parsed.success) return { status: "error", message: PLAN_SAVE_ERROR };
  return done(await setPrimaryContact(parsed.data));
}

// --- Lieux sûrs ---------------------------------------------------------------------

export async function addPlaceAction(input: unknown): Promise<PlanActionState> {
  const userId = await requireUserId();
  if (!userId) return { status: "error", message: SESSION_EXPIRED };
  const parsed = safePlaceSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? INVALID };
  return done(await addSafePlace(userId, parsed.data));
}

export async function updatePlaceAction(input: unknown): Promise<PlanActionState> {
  const userId = await requireUserId();
  if (!userId) return { status: "error", message: SESSION_EXPIRED };
  const parsed = updateSafePlaceSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? INVALID };
  const { id, ...place } = parsed.data;
  return done(await updateSafePlace(userId, id, place));
}

// --- Rappel et lettre ---------------------------------------------------------------

export async function saveReminderAction(input: unknown): Promise<PlanActionState> {
  const userId = await requireUserId();
  if (!userId) return { status: "error", message: SESSION_EXPIRED };
  const parsed = reminderSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? INVALID };
  return done(await saveReminder(userId, parsed.data.content));
}

export async function deleteReminderAction(): Promise<PlanActionState> {
  const userId = await requireUserId();
  if (!userId) return { status: "error", message: SESSION_EXPIRED };
  return done(await deleteReminder(userId));
}

export async function saveLetterAction(input: unknown): Promise<PlanActionState> {
  const userId = await requireUserId();
  if (!userId) return { status: "error", message: SESSION_EXPIRED };
  const parsed = letterSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? INVALID };
  return done(await saveLetter(userId, parsed.data));
}

export async function deleteLetterAction(): Promise<PlanActionState> {
  const userId = await requireUserId();
  if (!userId) return { status: "error", message: SESSION_EXPIRED };
  return done(await deleteLetter(userId));
}
