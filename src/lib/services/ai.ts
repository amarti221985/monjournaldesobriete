import "server-only";

import type { WeeklyInsightSource } from "@/lib/ai/dataset";
import { AI_CONSENT_VERSION, type AiPreferences } from "@/lib/ai/privacy";
import type { WeeklyReflection } from "@/lib/ai/schemas";
import { getProgressDataset } from "@/lib/services/progress";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

/*
 * Bilans intelligents (Sprint 12). Préférences sous RLS ; réservation et enregistrement
 * par RPC ciblées (auth.uid()). Aucun contenu (jeu de données, prompt, réponse) n'est
 * journalisé : seulement des codes techniques.
 */

export const DEFAULT_AI_PREFERENCES: AiPreferences = {
  aiEnabled: false,
  includeReflections: true,
  includeConsumptionContext: false,
  includeCravingContext: false,
  consentedAt: null,
  consentVersion: null,
};

export async function getAiPreferences(userId: string): Promise<AiPreferences> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_preferences")
    .select("ai_enabled, include_reflections, include_consumption_context, include_craving_context, consented_at, consent_version")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[ai] Lecture des préférences impossible", { code: error.code });
    throw new Error("Les préférences n'ont pas pu être chargées.");
  }
  if (!data) return DEFAULT_AI_PREFERENCES;
  return {
    // Un consentement donné pour une version antérieure du texte n'est plus valable.
    aiEnabled: data.ai_enabled && data.consent_version === AI_CONSENT_VERSION,
    includeReflections: data.include_reflections,
    includeConsumptionContext: data.include_consumption_context,
    includeCravingContext: data.include_craving_context,
    consentedAt: data.consented_at,
    consentVersion: data.consent_version,
  };
}

export type PreferencesUpdate = {
  aiEnabled: boolean;
  includeReflections: boolean;
  includeConsumptionContext: boolean;
  includeCravingContext: boolean;
};

/**
 * Active (consentement horodaté, version du texte présenté) ou désactive (révocation
 * horodatée ; les bilans existants sont conservés). Champs construits explicitement.
 */
export async function saveAiPreferences(userId: string, update: PreferencesUpdate): Promise<boolean> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const fields = {
    ai_enabled: update.aiEnabled,
    include_reflections: update.includeReflections,
    include_consumption_context: update.includeConsumptionContext,
    include_craving_context: update.includeCravingContext,
    ...(update.aiEnabled ? { consented_at: now, consent_version: AI_CONSENT_VERSION } : { revoked_at: now }),
  };
  // Pas d'upsert : ON CONFLICT DO UPDATE réécrirait user_id, colonne volontairement non modifiable.
  const updated = await supabase.from("ai_preferences").update(fields).eq("user_id", userId).select("user_id");
  let error = updated.error;
  if (!error && (updated.data ?? []).length === 0) {
    ({ error } = await supabase.from("ai_preferences").insert({ user_id: userId, ...fields }));
  }
  if (error) {
    console.error("[ai] Enregistrement des préférences impossible", { code: error.code });
    return false;
  }
  return true;
}

export type AiReflectionRecord = {
  id: string;
  periodStart: string;
  periodEnd: string;
  summary: string;
  content: WeeklyReflection;
  provider: string | null;
  model: string | null;
  promptVersion: string;
  generatedAt: string;
};

export async function listAiReflections(userId: string, limit = 12): Promise<AiReflectionRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_reflections")
    .select("id, period_start, period_end, summary, content, provider, model, prompt_version, generated_at")
    .eq("user_id", userId)
    .order("period_end", { ascending: false })
    .order("generated_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[ai] Lecture des bilans impossible", { code: error.code });
    throw new Error("Les bilans n'ont pas pu être chargés.");
  }
  return data.map((row) => ({
    id: row.id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    summary: row.summary,
    content: row.content as unknown as WeeklyReflection,
    provider: row.provider,
    model: row.model,
    promptVersion: row.prompt_version,
    generatedAt: row.generated_at,
  }));
}

/** `reservation` : jeton secret de libération, gardé côté serveur (jamais renvoyé au navigateur). */
export type ReserveResult = { ok: true; remaining: number; reservation: string } | { ok: false; reason: "consent" | "rate_limited" | "error" };

/** Réserve une génération (consentement actif, 3 / jour) AVANT l'appel au fournisseur. */
export async function reserveAiGeneration(): Promise<ReserveResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reserve_ai_generation");
  if (error) {
    if (error.message === "ai_consent_required") return { ok: false, reason: "consent" };
    if (error.message === "ai_rate_limited") return { ok: false, reason: "rate_limited" };
    console.error("[ai] Réservation impossible", { code: error.code });
    return { ok: false, reason: "error" };
  }
  const row = data[0];
  if (!row) return { ok: false, reason: "error" };
  return { ok: true, remaining: row.remaining, reservation: row.reservation };
}

/**
 * Rend un essai qui a échoué côté fournisseur ou configuration (aucun bilan produit).
 * Exige le jeton de la réservation : impossible de libérer la réservation d'une autre requête.
 */
export async function releaseAiGeneration(reservation: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("release_ai_generation", { p_reservation: reservation });
  if (error) console.error("[ai] Libération impossible", { code: error.code });
  return !error && data === true;
}

export async function saveAiReflection(input: {
  periodStart: string;
  periodEnd: string;
  reflection: WeeklyReflection;
  provider: string;
  model: string;
  promptVersion: string;
}): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_ai_reflection", {
    p_period_start: input.periodStart,
    p_period_end: input.periodEnd,
    p_summary: input.reflection.summary,
    p_content: input.reflection as unknown as Json,
    p_provider: input.provider,
    p_model: input.model,
    p_prompt_version: input.promptVersion,
  });
  if (error) {
    console.error("[ai] Enregistrement du bilan impossible", { code: error.code });
    return false;
  }
  return true;
}

export async function deleteAiReflection(userId: string, id: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("ai_reflections").delete().eq("user_id", userId).eq("id", id).select("id");
  if (error) console.error("[ai] Suppression du bilan impossible", { code: error.code });
  return !error && data.length > 0;
}

export async function deleteAllAiReflections(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("ai_reflections").delete().eq("user_id", userId);
  if (error) console.error("[ai] Suppression des bilans impossible", { code: error.code });
  return !error;
}

// ---------------------------------------------------------------------------
// Données d'un bilan hebdomadaire (lues seulement pour les catégories autorisées)
// ---------------------------------------------------------------------------

/**
 * Sources du bilan pour l'utilisateur connecté, sur une période courte. Les textes ne
 * sont lus que si la catégorie est autorisée ; jamais la lettre, les contacts, les lieux,
 * le rappel, la raison, les notes libres ni les précisions « Autre ».
 */
export async function collectWeeklyInsightSource(
  userId: string,
  range: { start: string; end: string },
  preferences: AiPreferences,
): Promise<WeeklyInsightSource> {
  const supabase = await createClient();
  const [dataset, reflections, consumption, cravings, achievements] = await Promise.all([
    getProgressDataset(userId),
    preferences.includeReflections
      ? supabase
          .from("daily_checkins")
          .select("checkin_date, status, victory_text, proud_of_text, lesson_text, tomorrow_intention_text")
          .eq("user_id", userId)
          .not("completed_at", "is", null)
          .gte("checkin_date", range.start)
          .lte("checkin_date", range.end)
      : Promise.resolve({ data: [], error: null }),
    preferences.includeConsumptionContext
      ? supabase
          .from("daily_checkins")
          .select("checkin_date, consumption_events ( context_text, reflection_text, next_time_strategy_text )")
          .eq("user_id", userId)
          .eq("status", "consumed")
          .not("completed_at", "is", null)
          .gte("checkin_date", range.start)
          .lte("checkin_date", range.end)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("craving_events")
      .select(
        preferences.includeCravingContext
          ? "local_date, initial_craving_score, final_craving_score, context_text, outcome_text, craving_interventions ( helped_text, craving_strategies ( name_fr ) )"
          : "local_date, initial_craving_score, final_craving_score, craving_interventions ( craving_strategies ( name_fr ) )",
      )
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("local_date", range.start)
      .lte("local_date", range.end)
      .order("started_at"),
    supabase
      .from("user_achievements")
      .select("achievement_definitions ( name_fr )")
      .eq("user_id", userId)
      .gte("earned_at", `${range.start}T00:00:00Z`),
  ]);

  const failed = [reflections, consumption, cravings, achievements].find((result) => result.error);
  if (failed?.error) {
    console.error("[ai] Lecture des données du bilan impossible", { code: failed.error.code });
    throw new Error("Les données du bilan n'ont pas pu être lues.");
  }

  type CravingRow = {
    local_date: string;
    initial_craving_score: number;
    final_craving_score: number | null;
    context_text?: string | null;
    outcome_text?: string | null;
    craving_interventions:
      | { helped_text?: string | null; craving_strategies: { name_fr: string } | null }
      | { helped_text?: string | null; craving_strategies: { name_fr: string } | null }[]
      | null;
  };
  type ReflectionRow = {
    checkin_date: string;
    status: "sober" | "sober_with_craving" | "consumed";
    victory_text: string | null;
    proud_of_text: string | null;
    lesson_text: string | null;
    tomorrow_intention_text: string | null;
  };
  type ConsumptionRow = {
    checkin_date: string;
    consumption_events: { context_text: string | null; reflection_text: string | null; next_time_strategy_text: string | null }[];
  };

  return {
    range,
    checkins: dataset.checkins.filter((item) => item.date >= range.start && item.date <= range.end),
    labels: dataset.labels,
    reflections: ((reflections.data ?? []) as ReflectionRow[]).map((row) => ({
      date: row.checkin_date,
      status: row.status,
      victory: row.victory_text,
      proudOf: row.proud_of_text,
      lesson: row.lesson_text,
      tomorrowIntention: row.tomorrow_intention_text,
    })),
    consumptionTexts: ((consumption.data ?? []) as ConsumptionRow[]).flatMap((row) =>
      row.consumption_events.map((event) => ({
        date: row.checkin_date,
        context: event.context_text,
        reflection: event.reflection_text,
        nextTime: event.next_time_strategy_text,
      })),
    ),
    cravings: ((cravings.data ?? []) as unknown as CravingRow[])
      .filter((row) => row.final_craving_score !== null)
      .map((row) => {
        const intervention = Array.isArray(row.craving_interventions) ? row.craving_interventions[0] : row.craving_interventions;
        return {
          date: row.local_date,
          initial: row.initial_craving_score,
          final: row.final_craving_score ?? row.initial_craving_score,
          strategyName: intervention?.craving_strategies?.name_fr ?? null,
          context: row.context_text ?? null,
          helped: intervention?.helped_text ?? null,
          outcome: row.outcome_text ?? null,
        };
      }),
    achievementsUnlocked: ((achievements.data ?? []) as { achievement_definitions: { name_fr: string } | null }[])
      .map((row) => row.achievement_definitions?.name_fr)
      .filter((name): name is string => Boolean(name)),
  };
}
