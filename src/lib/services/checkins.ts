import "server-only";

import { cache } from "react";

import type { CheckinPayload } from "@/features/checkin/schemas";
import type { CheckinStatus } from "@/features/checkin/constants";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

/*
 * Accès aux check-ins. Lectures sous RLS ; écritures uniquement via la RPC
 * transactionnelle public.save_checkin() (ADR-035).
 */

export type CatalogueItem = { slug: string; name: string };
export type EmotionItem = CatalogueItem & { category: "positive" | "difficult" };

export type CheckinCatalogues = {
  emotions: EmotionItem[];
  triggers: CatalogueItem[];
  achievements: CatalogueItem[];
};

/** Catalogues contrôlés (lecture seule), chargés en parallèle. */
export const getCheckinCatalogues = cache(async (): Promise<CheckinCatalogues> => {
  const supabase = await createClient();
  const [emotions, triggers, achievements] = await Promise.all([
    supabase.from("emotions").select("slug, name_fr, category").order("sort_order"),
    supabase.from("trigger_types").select("slug, name_fr").order("sort_order"),
    supabase.from("achievement_types").select("slug, name_fr").order("sort_order"),
  ]);

  const error = emotions.error ?? triggers.error ?? achievements.error;
  if (error) {
    console.error("[checkins] Lecture des catalogues impossible", { code: error.code });
    throw new Error("Les catalogues n'ont pas pu être chargés.");
  }

  return {
    emotions: (emotions.data ?? []).map((row) => ({
      slug: row.slug,
      name: row.name_fr,
      category: row.category === "positive" ? "positive" : "difficult",
    })),
    triggers: (triggers.data ?? []).map((row) => ({ slug: row.slug, name: row.name_fr })),
    achievements: (achievements.data ?? []).map((row) => ({ slug: row.slug, name: row.name_fr })),
  };
});

export type CheckinConsumptionEvent = {
  id: string;
  userSubstanceId: string;
  substanceName: string;
  quantity: number | null;
  unit: string | null;
  /** HH:MM (heure locale approximative) */
  occurredAt: string | null;
  cravingBefore: number | null;
  contextText: string | null;
  reflectionText: string | null;
  nextTimeStrategyText: string | null;
};

export type CheckinRecord = {
  id: string;
  checkinDate: string;
  status: CheckinStatus;
  moodScore: number | null;
  energyScore: number | null;
  stressScore: number | null;
  cravingScore: number | null;
  victoryText: string | null;
  proudOfText: string | null;
  lessonText: string | null;
  tomorrowIntentionText: string | null;
  notes: string | null;
  /** NULL = brouillon (ADR-039). */
  completedAt: string | null;
  emotions: EmotionItem[];
  triggers: (CatalogueItem & { customLabel: string | null })[];
  achievements: (CatalogueItem & { customLabel: string | null })[];
  consumptionEvents: CheckinConsumptionEvent[];
};

const CHECKIN_SELECT = `
  id, checkin_date, status, mood_score, energy_score, stress_score, craving_score,
  victory_text, proud_of_text, lesson_text, tomorrow_intention_text, notes, completed_at,
  checkin_emotions ( emotions ( slug, name_fr, category, sort_order ) ),
  checkin_triggers ( custom_label, trigger_types ( slug, name_fr, sort_order ) ),
  checkin_achievements ( custom_label, achievement_types ( slug, name_fr, sort_order ) ),
  consumption_events (
    id, user_substance_id, quantity, unit, occurred_at, craving_before,
    context_text, reflection_text, next_time_strategy_text, created_at,
    user_substances ( custom_name, substances ( name_fr ) )
  )
`;

const bySortOrder = (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order;

/** Check-in (terminé ou brouillon) d'une journée locale, avec toutes ses relations, en une requête. */
export const getCheckinForDate = cache(
  async (userId: string, checkinDate: string): Promise<CheckinRecord | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("daily_checkins")
      .select(CHECKIN_SELECT)
      .eq("user_id", userId)
      .eq("checkin_date", checkinDate)
      .maybeSingle();

    if (error) {
      console.error("[checkins] Lecture du check-in impossible", { code: error.code });
      throw new Error("Le check-in n'a pas pu être chargé.");
    }
    if (!data) return null;

    return {
      id: data.id,
      checkinDate: data.checkin_date,
      status: data.status,
      moodScore: data.mood_score,
      energyScore: data.energy_score,
      stressScore: data.stress_score,
      cravingScore: data.craving_score,
      victoryText: data.victory_text,
      proudOfText: data.proud_of_text,
      lessonText: data.lesson_text,
      tomorrowIntentionText: data.tomorrow_intention_text,
      notes: data.notes,
      completedAt: data.completed_at,
      emotions: data.checkin_emotions
        .map((row) => row.emotions)
        .sort(bySortOrder)
        .map((emotion) => ({
          slug: emotion.slug,
          name: emotion.name_fr,
          category: emotion.category === "positive" ? "positive" : "difficult",
        })),
      triggers: data.checkin_triggers
        .sort((a, b) => bySortOrder(a.trigger_types, b.trigger_types))
        .map((row) => ({ slug: row.trigger_types.slug, name: row.trigger_types.name_fr, customLabel: row.custom_label })),
      achievements: data.checkin_achievements
        .sort((a, b) => bySortOrder(a.achievement_types, b.achievement_types))
        .map((row) => ({
          slug: row.achievement_types.slug,
          name: row.achievement_types.name_fr,
          customLabel: row.custom_label,
        })),
      consumptionEvents: data.consumption_events
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((event) => ({
          id: event.id,
          userSubstanceId: event.user_substance_id,
          substanceName: event.user_substances.custom_name ?? event.user_substances.substances.name_fr,
          quantity: event.quantity,
          unit: event.unit,
          occurredAt: event.occurred_at?.slice(0, 5) ?? null,
          cravingBefore: event.craving_before,
          contextText: event.context_text,
          reflectionText: event.reflection_text,
          nextTimeStrategyText: event.next_time_strategy_text,
        })),
    };
  },
);

export type SaveCheckinResult =
  | { status: "saved"; completed: boolean }
  | { status: "already_completed" }
  | { status: "error" };

/**
 * Enregistre via la RPC transactionnelle. `finalize` : check-in terminé.
 * Journalise uniquement le code technique (jamais le contenu du check-in).
 */
export async function saveCheckin(payload: CheckinPayload, finalize: boolean): Promise<SaveCheckinResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_checkin", {
    payload: payload as unknown as Json,
    finalize,
  });

  if (error) {
    if (error.message === "checkin_already_completed") return { status: "already_completed" };
    console.error("[checkins] Enregistrement impossible", { code: error.code, reason: error.message });
    return { status: "error" };
  }

  const completed = typeof data === "object" && data !== null && "completed" in data && data.completed === true;
  return { status: "saved", completed };
}

/** Supprime le brouillon d'une journée (« Recommencer »). La RLS interdit de supprimer un check-in terminé. */
export async function discardCheckinDraft(userId: string, checkinDate: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("daily_checkins")
    .delete()
    .eq("user_id", userId)
    .eq("checkin_date", checkinDate)
    .is("completed_at", null);

  if (error) {
    console.error("[checkins] Suppression du brouillon impossible", { code: error.code });
    return false;
  }
  return true;
}
