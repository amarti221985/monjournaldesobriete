import "server-only";

import type { PlanPlace, PlanStrategy } from "@/features/plan/logic";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

/*
 * « Mon plan » (Sprint 8). Lectures sous RLS (filtre user_id explicite en plus).
 * Écritures : RPC transactionnelles pour les opérations en plusieurs étapes, sinon
 * écritures directes limitées à l'utilisateur (user_id de la session + RLS). Une ligne
 * d'un autre compte n'est jamais trouvée : 0 ligne modifiée → « introuvable ».
 * Aucun contenu (raison, notes, lieux, rappel, lettre) n'est jamais journalisé.
 */

export type PlanTrigger = {
  id: string;
  triggerSlug: string | null;
  name: string;
  customLabel: string | null;
  notes: string | null;
};

export type PlanLetter = { title: string | null; content: string; updatedAt: string };
export type PlanReminder = { content: string; updatedAt: string };

function fail(scope: string, error: { code: string }): never {
  console.error(`[plan] ${scope} impossible`, { code: error.code });
  throw new Error("Le plan n'a pas pu être chargé.");
}

// ---------------------------------------------------------------------------
// Lectures
// ---------------------------------------------------------------------------

export async function getPlanTriggers(userId: string): Promise<PlanTrigger[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_personal_triggers")
    .select("id, custom_label, notes, trigger_types ( slug, name_fr )")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at");
  if (error) fail("Lecture des déclencheurs", error);
  return data.map((row) => ({
    id: row.id,
    triggerSlug: row.trigger_types?.slug ?? null,
    name: row.trigger_types?.name_fr ?? row.custom_label ?? "",
    customLabel: row.custom_label,
    notes: row.notes,
  }));
}

export async function getPlanStrategies(userId: string): Promise<PlanStrategy[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_personal_strategies")
    .select("id, custom_name, notes, default_duration_minutes, is_favorite, craving_strategies ( slug, name_fr )")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at");
  if (error) fail("Lecture des stratégies", error);
  return data.map((row) => ({
    id: row.id,
    strategySlug: row.craving_strategies?.slug ?? null,
    name: row.craving_strategies?.name_fr ?? row.custom_name ?? "",
    customName: row.custom_name,
    notes: row.notes,
    defaultDurationMinutes: row.default_duration_minutes,
    isFavorite: row.is_favorite,
  }));
}

export async function getSafePlaces(userId: string): Promise<PlanPlace[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("safe_places")
    .select("id, name, description, is_favorite")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at");
  if (error) fail("Lecture des lieux", error);
  return data.map((row) => ({ id: row.id, name: row.name, description: row.description, isFavorite: row.is_favorite }));
}

export async function getReminder(userId: string): Promise<PlanReminder | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("personal_reminders")
    .select("content, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) fail("Lecture du rappel", error);
  return data ? { content: data.content, updatedAt: data.updated_at } : null;
}

export async function getSelfLetter(userId: string): Promise<PlanLetter | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("self_letters")
    .select("title, content, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) fail("Lecture de la lettre", error);
  return data ? { title: data.title, content: data.content, updatedAt: data.updated_at } : null;
}

// ---------------------------------------------------------------------------
// Écritures
// ---------------------------------------------------------------------------

export type PlanWriteResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "duplicate" | "too_many_favorites" | "primary_substance" | "last_substance" | "error" };

type DbError = { code: string; message: string };

function toFailure(scope: string, error: DbError): Extract<PlanWriteResult, { ok: false }> {
  if (error.message.includes("too_many_favorites")) return { ok: false, reason: "too_many_favorites" };
  if (error.code === "23505") return { ok: false, reason: "duplicate" };
  if (error.message.endsWith("_not_found")) return { ok: false, reason: "not_found" };
  if (error.message === "primary_substance") return { ok: false, reason: "primary_substance" };
  if (error.message === "last_substance") return { ok: false, reason: "last_substance" };
  console.error(`[plan] ${scope} impossible`, { code: error.code, reason: error.message });
  return { ok: false, reason: "error" };
}

/** Résultat d'une écriture directe : aucune ligne touchée = élément introuvable (autre compte). */
function toResult(scope: string, error: DbError | null, rows: unknown[] | null): PlanWriteResult {
  if (error) return toFailure(scope, error);
  return rows && rows.length > 0 ? { ok: true } : { ok: false, reason: "not_found" };
}

function rpcResult(scope: string, error: DbError | null): PlanWriteResult {
  return error ? toFailure(scope, error) : { ok: true };
}

// --- Substances ---------------------------------------------------------------------

export async function updateUserSubstance(
  userId: string,
  input: { id: string; goal: string; startedOn: string; customName?: string },
): Promise<PlanWriteResult> {
  const supabase = await createClient();
  const { data: current, error: readError } = await supabase
    .from("user_substances")
    .select("id, substances ( category )")
    .eq("user_id", userId)
    .eq("id", input.id)
    .eq("is_active", true)
    .maybeSingle();
  if (readError) return toFailure("Lecture de la substance", readError);
  if (!current) return { ok: false, reason: "not_found" };

  // Changer la date ou l'objectif ne touche jamais aux check-ins ni aux moments d'envie.
  const { data, error } = await supabase
    .from("user_substances")
    .update({
      goal: input.goal as "abstinence" | "reduction" | "observation",
      started_on: input.startedOn,
      ...(current.substances.category === "other" ? { custom_name: input.customName ?? null } : {}),
    })
    .eq("user_id", userId)
    .eq("id", input.id)
    .select("id");
  return toResult("Modification de la substance", error, data);
}

export async function addUserSubstance(payload: {
  slug: string;
  customName?: string;
  goal: string;
  startedOn: string;
}): Promise<PlanWriteResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_user_substance", { payload: payload as Json });
  return rpcResult("Ajout de la substance", error);
}

export async function setPrimarySubstance(id: string): Promise<PlanWriteResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_primary_substance", { p_user_substance_id: id });
  return rpcResult("Substance principale", error);
}

export async function deactivateUserSubstance(id: string): Promise<PlanWriteResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("deactivate_user_substance", { p_user_substance_id: id });
  return rpcResult("Arrêt du suivi", error);
}

// --- Raison et motivations ----------------------------------------------------------

/** Met à jour la raison principale (la plus récente), ou la crée si elle manque. */
export async function saveReason(userId: string, reason: string): Promise<PlanWriteResult> {
  const supabase = await createClient();
  const { data: current, error: readError } = await supabase
    .from("personal_reasons")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (readError) return toFailure("Lecture de la raison", readError);

  const { data, error } = current
    ? await supabase.from("personal_reasons").update({ reason_text: reason }).eq("user_id", userId).eq("id", current.id).select("id")
    : await supabase.from("personal_reasons").insert({ user_id: userId, reason_text: reason }).select("id");
  return toResult("Enregistrement de la raison", error, data);
}

export async function saveMotivations(payload: { motivations: string[]; otherLabel?: string }): Promise<PlanWriteResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_motivations", { payload: payload as Json });
  return rpcResult("Enregistrement des motivations", error);
}

// --- Déclencheurs personnels --------------------------------------------------------

export async function addPersonalTrigger(
  userId: string,
  input: { triggerSlug: string | null; customLabel?: string; notes?: string },
): Promise<PlanWriteResult> {
  const supabase = await createClient();
  let triggerTypeId: string | null = null;
  if (input.triggerSlug) {
    const { data: type } = await supabase.from("trigger_types").select("id").eq("slug", input.triggerSlug).maybeSingle();
    if (!type) return { ok: false, reason: "not_found" };
    triggerTypeId = type.id;
  }
  const { data, error } = await supabase
    .from("user_personal_triggers")
    .insert({
      user_id: userId,
      trigger_type_id: triggerTypeId,
      custom_label: triggerTypeId ? null : (input.customLabel ?? null),
      notes: input.notes ?? null,
    })
    .select("id");
  return toResult("Ajout du déclencheur", error, data);
}

export async function updatePersonalTriggerNotes(userId: string, id: string, notes?: string): Promise<PlanWriteResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_personal_triggers")
    .update({ notes: notes ?? null })
    .eq("user_id", userId)
    .eq("id", id)
    .select("id");
  return toResult("Modification du déclencheur", error, data);
}

/** Élément purement personnel, jamais référencé par l'historique : suppression après confirmation. */
export async function deletePlanItem(
  userId: string,
  table: "user_personal_triggers" | "user_personal_strategies" | "safe_places" | "support_contacts",
  id: string,
): Promise<PlanWriteResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from(table).delete().eq("user_id", userId).eq("id", id).select("id");
  return toResult("Suppression", error, data);
}

// --- Stratégies personnelles --------------------------------------------------------

export async function addPersonalStrategy(
  userId: string,
  input: { strategySlug: string | null; customName?: string; notes?: string; defaultDurationMinutes: number | null },
): Promise<PlanWriteResult> {
  const supabase = await createClient();
  let strategyId: string | null = null;
  if (input.strategySlug) {
    const { data: strategy } = await supabase.from("craving_strategies").select("id").eq("slug", input.strategySlug).maybeSingle();
    if (!strategy) return { ok: false, reason: "not_found" };
    strategyId = strategy.id;
  }
  const { data, error } = await supabase
    .from("user_personal_strategies")
    .insert({
      user_id: userId,
      strategy_id: strategyId,
      custom_name: strategyId ? null : (input.customName ?? null),
      notes: input.notes ?? null,
      default_duration_minutes: input.defaultDurationMinutes,
    })
    .select("id");
  return toResult("Ajout de la stratégie", error, data);
}

export async function updatePersonalStrategy(
  userId: string,
  input: { id: string; customName?: string; notes?: string; defaultDurationMinutes: number | null },
): Promise<PlanWriteResult> {
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("user_personal_strategies")
    .select("strategy_id")
    .eq("user_id", userId)
    .eq("id", input.id)
    .maybeSingle();
  if (!current) return { ok: false, reason: "not_found" };
  const { data, error } = await supabase
    .from("user_personal_strategies")
    .update({
      notes: input.notes ?? null,
      default_duration_minutes: input.defaultDurationMinutes,
      // Le nom n'est modifiable que pour une stratégie personnelle.
      ...(current.strategy_id === null && input.customName ? { custom_name: input.customName } : {}),
    })
    .eq("user_id", userId)
    .eq("id", input.id)
    .select("id");
  return toResult("Modification de la stratégie", error, data);
}

/** Favori : la limite de 3 est appliquée par la base (trigger enforce_max_favorites). */
export async function setFavorite(
  userId: string,
  table: "user_personal_strategies" | "safe_places",
  id: string,
  favorite: boolean,
): Promise<PlanWriteResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from(table).update({ is_favorite: favorite }).eq("user_id", userId).eq("id", id).select("id");
  return toResult("Favori", error, data);
}

// --- Personnes de soutien -----------------------------------------------------------

type ContactInput = { name: string; relationship?: string; phone?: string; email?: string };

export async function addSupportContact(userId: string, input: ContactInput): Promise<PlanWriteResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("support_contacts")
    .insert({
      user_id: userId,
      name: input.name,
      relationship: input.relationship ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
    })
    .select("id");
  return toResult("Ajout du contact", error, data);
}

export async function updateSupportContact(userId: string, id: string, input: ContactInput): Promise<PlanWriteResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("support_contacts")
    .update({ name: input.name, relationship: input.relationship ?? null, phone: input.phone ?? null, email: input.email ?? null })
    .eq("user_id", userId)
    .eq("id", id)
    .select("id");
  return toResult("Modification du contact", error, data);
}

export async function setPrimaryContact(id: string | null): Promise<PlanWriteResult> {
  const supabase = await createClient();
  // NULL retire la personne principale (le type généré n'exprime pas le paramètre nullable).
  const { error } = await supabase.rpc("set_primary_support_contact", { p_contact_id: id as string });
  return rpcResult("Personne principale", error);
}

export async function countSupportContacts(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase.from("support_contacts").select("id", { count: "exact", head: true }).eq("user_id", userId);
  return count ?? 0;
}

// --- Lieux sûrs ---------------------------------------------------------------------

export async function addSafePlace(userId: string, input: { name: string; description?: string }): Promise<PlanWriteResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("safe_places")
    .insert({ user_id: userId, name: input.name, description: input.description ?? null })
    .select("id");
  return toResult("Ajout du lieu", error, data);
}

export async function updateSafePlace(
  userId: string,
  id: string,
  input: { name: string; description?: string },
): Promise<PlanWriteResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("safe_places")
    .update({ name: input.name, description: input.description ?? null })
    .eq("user_id", userId)
    .eq("id", id)
    .select("id");
  return toResult("Modification du lieu", error, data);
}

// --- Rappel et lettre (un par utilisateur : upsert sur user_id) ---------------------

/*
 * Rappel et lettre : une ligne par personne, enregistrée par mise à jour puis insertion. Pas
 * d'upsert : ON CONFLICT DO UPDATE réécrirait user_id, colonne volontairement non modifiable
 * (Sprint 11), ce qui faisait échouer chaque enregistrement (permission refusée).
 */

export async function saveReminder(userId: string, content: string): Promise<PlanWriteResult> {
  const scope = "Enregistrement du rappel";
  const supabase = await createClient();
  const updated = await supabase.from("personal_reminders").update({ content }).eq("user_id", userId).select("id");
  if (updated.error) return toFailure(scope, updated.error);
  if ((updated.data ?? []).length > 0) return { ok: true };
  const inserted = await supabase.from("personal_reminders").insert({ user_id: userId, content }).select("id");
  return toResult(scope, inserted.error, inserted.data);
}

export async function deleteReminder(userId: string): Promise<PlanWriteResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("personal_reminders").delete().eq("user_id", userId);
  return error ? toFailure("Suppression du rappel", error) : { ok: true };
}

export async function saveLetter(userId: string, input: { title?: string; content: string }): Promise<PlanWriteResult> {
  const scope = "Enregistrement de la lettre";
  const fields = { title: input.title ?? null, content: input.content };
  const supabase = await createClient();
  const updated = await supabase.from("self_letters").update(fields).eq("user_id", userId).select("id");
  if (updated.error) return toFailure(scope, updated.error);
  if ((updated.data ?? []).length > 0) return { ok: true };
  const inserted = await supabase.from("self_letters").insert({ user_id: userId, ...fields }).select("id");
  return toResult(scope, inserted.error, inserted.data);
}

export async function deleteLetter(userId: string): Promise<PlanWriteResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("self_letters").delete().eq("user_id", userId);
  return error ? toFailure("Suppression de la lettre", error) : { ok: true };
}
