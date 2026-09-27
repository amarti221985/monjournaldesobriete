import "server-only";

import { cache } from "react";

import type { CompleteCravingPayload, StartCravingEventPayload, StartInterventionPayload, TimerAction } from "@/features/craving/schemas";
import { CUSTOM_STRATEGY } from "@/features/craving/constants";
import type { CompletedIntervention } from "@/features/craving/logic";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

/*
 * Mode envie (Sprint 7). Lectures sous RLS (filtre user_id explicite en plus) ;
 * écritures uniquement via les RPC transactionnelles SECURITY INVOKER.
 * Aucun contenu (contexte, stratégie personnelle, notes) n'est jamais journalisé.
 */

export type CravingStrategy = {
  slug: string;
  name: string;
  description: string;
  defaultDurationMinutes: number | null;
};

export type CravingIntervention = {
  strategySlug: string | null;
  strategyName: string | null;
  customStrategyText: string | null;
  helpedText: string | null;
  plannedMinutes: number | null;
  actualSeconds: number | null;
  startedAt: string;
  pausedAt: string | null;
  pausedSeconds: number;
  completedAt: string | null;
};

export type CravingEventDetail = {
  id: string;
  status: "in_progress" | "completed" | "abandoned";
  localDate: string;
  initial: number;
  final: number | null;
  triggerUnknown: boolean;
  contextText: string | null;
  outcomeText: string | null;
  startedAt: string;
  completedAt: string | null;
  substances: { id: string; name: string }[];
  emotions: { slug: string; name: string }[];
  triggers: { slug: string; name: string; customLabel: string | null }[];
  intervention: CravingIntervention | null;
};

/** Catalogue des stratégies actives (lecture seule). */
export const getCravingStrategies = cache(async (): Promise<CravingStrategy[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("craving_strategies")
    .select("slug, name_fr, description_fr, default_duration_minutes")
    .order("sort_order");
  if (error) {
    console.error("[craving] Lecture des stratégies impossible", { code: error.code });
    throw new Error("Les stratégies n'ont pas pu être chargées.");
  }
  return data.map((row) => ({
    slug: row.slug,
    name: row.name_fr,
    description: row.description_fr,
    defaultDurationMinutes: row.default_duration_minutes,
  }));
});

const DETAIL_SELECT = `id, status, local_date, initial_craving_score, final_craving_score, trigger_unknown,
  context_text, outcome_text, started_at, completed_at,
  craving_event_substances ( user_substance_id, user_substances ( custom_name, substances ( name_fr ) ) ),
  craving_event_emotions ( emotions ( slug, name_fr, sort_order ) ),
  craving_event_triggers ( custom_label, trigger_types ( slug, name_fr, sort_order ) ),
  craving_interventions ( custom_strategy_text, helped_text, planned_duration_minutes, actual_duration_seconds,
    started_at, paused_at, paused_seconds, completed_at, craving_strategies ( slug, name_fr ) )`;

/** PostgREST renvoie un objet (relation 1-1) ou un tableau selon la détection. */
function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

type DetailRow = {
  id: string;
  status: CravingEventDetail["status"];
  local_date: string;
  initial_craving_score: number;
  final_craving_score: number | null;
  trigger_unknown: boolean;
  context_text: string | null;
  outcome_text: string | null;
  started_at: string;
  completed_at: string | null;
  craving_event_substances: {
    user_substance_id: string;
    user_substances: { custom_name: string | null; substances: { name_fr: string } };
  }[];
  craving_event_emotions: { emotions: { slug: string; name_fr: string; sort_order: number } }[];
  craving_event_triggers: {
    custom_label: string | null;
    trigger_types: { slug: string; name_fr: string; sort_order: number };
  }[];
  craving_interventions:
    | {
        custom_strategy_text: string | null;
        helped_text: string | null;
        planned_duration_minutes: number | null;
        actual_duration_seconds: number | null;
        started_at: string;
        paused_at: string | null;
        paused_seconds: number;
        completed_at: string | null;
        craving_strategies: { slug: string; name_fr: string } | null;
      }
    | {
        custom_strategy_text: string | null;
        helped_text: string | null;
        planned_duration_minutes: number | null;
        actual_duration_seconds: number | null;
        started_at: string;
        paused_at: string | null;
        paused_seconds: number;
        completed_at: string | null;
        craving_strategies: { slug: string; name_fr: string } | null;
      }[]
    | null;
};

function toDetail(row: DetailRow): CravingEventDetail {
  const intervention = firstOf(row.craving_interventions);
  return {
    id: row.id,
    status: row.status,
    localDate: row.local_date,
    initial: row.initial_craving_score,
    final: row.final_craving_score,
    triggerUnknown: row.trigger_unknown,
    contextText: row.context_text,
    outcomeText: row.outcome_text,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    substances: row.craving_event_substances.map((item) => ({
      id: item.user_substance_id,
      name: item.user_substances.custom_name?.trim() || item.user_substances.substances.name_fr,
    })),
    emotions: [...row.craving_event_emotions]
      .sort((a, b) => a.emotions.sort_order - b.emotions.sort_order)
      .map((item) => ({ slug: item.emotions.slug, name: item.emotions.name_fr })),
    triggers: [...row.craving_event_triggers]
      .sort((a, b) => a.trigger_types.sort_order - b.trigger_types.sort_order)
      .map((item) => ({ slug: item.trigger_types.slug, name: item.trigger_types.name_fr, customLabel: item.custom_label })),
    intervention: intervention
      ? {
          strategySlug: intervention.craving_strategies?.slug ?? null,
          strategyName: intervention.craving_strategies?.name_fr ?? null,
          customStrategyText: intervention.custom_strategy_text,
          helpedText: intervention.helped_text,
          plannedMinutes: intervention.planned_duration_minutes,
          actualSeconds: intervention.actual_duration_seconds,
          startedAt: intervention.started_at,
          pausedAt: intervention.paused_at,
          pausedSeconds: intervention.paused_seconds,
          completedAt: intervention.completed_at,
        }
      : null,
  };
}

/** Moment d'envie de l'utilisateur (null s'il n'existe pas ou appartient à un autre compte). */
export async function getCravingEvent(userId: string, eventId: string): Promise<CravingEventDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("craving_events")
    .select(DETAIL_SELECT)
    .eq("user_id", userId)
    .eq("id", eventId)
    .maybeSingle();
  if (error) {
    console.error("[craving] Lecture du moment impossible", { code: error.code });
    throw new Error("Le moment n'a pas pu être chargé.");
  }
  return data ? toDetail(data as unknown as DetailRow) : null;
}

/** Moments TERMINÉS les plus récents, en une requête (relations embarquées, aucun N+1). */
export async function getCompletedCravingEvents(userId: string, limit: number): Promise<CravingEventDetail[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("craving_events")
    .select(DETAIL_SELECT)
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[craving] Lecture de l'historique impossible", { code: error.code });
    throw new Error("L'historique n'a pas pu être chargé.");
  }
  return (data as unknown as DetailRow[]).map(toDetail);
}

/** Données minimales de TOUS les moments terminés avec intervention, pour l'analyse des stratégies. */
export async function getCompletedInterventions(userId: string): Promise<CompletedIntervention[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("craving_events")
    .select("initial_craving_score, final_craving_score, craving_interventions ( strategy_id, craving_strategies ( slug ) )")
    .eq("user_id", userId)
    .eq("status", "completed");
  if (error) {
    console.error("[craving] Lecture des interventions impossible", { code: error.code });
    throw new Error("Les interventions n'ont pas pu être chargées.");
  }
  type Row = {
    initial_craving_score: number;
    final_craving_score: number | null;
    craving_interventions:
      | { strategy_id: string | null; craving_strategies: { slug: string } | null }
      | { strategy_id: string | null; craving_strategies: { slug: string } | null }[]
      | null;
  };
  return (data as unknown as Row[]).flatMap((row) => {
    const intervention = firstOf(row.craving_interventions);
    if (!intervention || row.final_craving_score === null) return [];
    return [
      {
        initial: row.initial_craving_score,
        final: row.final_craving_score,
        strategyKey: intervention.craving_strategies?.slug ?? CUSTOM_STRATEGY,
      },
    ];
  });
}

/**
 * Moment en cours d'AUJOURD'HUI (journée locale), pour le CTA « Continuer mon
 * intervention ». Lecture seule : les moments d'une journée passée sont ignorés ici
 * et fermés par close_stale_craving_events() sur les pages du mode envie.
 */
export const getActiveCravingEventId = cache(async (userId: string, today: string): Promise<string | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("craving_events")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .eq("local_date", today)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[craving] Lecture du moment en cours impossible", { code: error.code });
    return null;
  }
  return data?.id ?? null;
});

/** Transition documentée : moments en cours d'une journée passée → « abandoned » (ADR-062). */
export async function closeStaleCravingEvents(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_stale_craving_events");
  if (error) console.error("[craving] Fermeture des moments expirés impossible", { code: error.code });
}

// ---------------------------------------------------------------------------
// Écritures (RPC). Seul le code technique est journalisé, jamais le contenu.
// ---------------------------------------------------------------------------

export type CravingWriteResult = { ok: true } | { ok: false; reason: "not_found" | "not_in_progress" | "error" };

function toFailure(error: { code: string; message: string }, scope: string): CravingWriteResult {
  if (error.message === "craving_event_not_found") return { ok: false, reason: "not_found" };
  if (error.message === "craving_event_not_in_progress") return { ok: false, reason: "not_in_progress" };
  console.error(`[craving] ${scope} impossible`, { code: error.code, reason: error.message });
  return { ok: false, reason: "error" };
}

export async function startCravingEvent(payload: StartCravingEventPayload): Promise<CravingWriteResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_craving_event", { payload: payload as unknown as Json });
  return error ? toFailure(error, "Démarrage du moment") : { ok: true };
}

export async function startCravingIntervention(eventId: string, payload: StartInterventionPayload): Promise<CravingWriteResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("start_craving_intervention", {
    p_event_id: eventId,
    payload: payload as unknown as Json,
  });
  return error ? toFailure(error, "Démarrage de l'intervention") : { ok: true };
}

export type TimerResult =
  | { ok: true; timer: { startedAt: string; pausedAt: string | null; pausedSeconds: number; completedAt: string | null } }
  | Extract<CravingWriteResult, { ok: false }>;

export async function updateCravingTimer(eventId: string, action: TimerAction): Promise<TimerResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_craving_timer", { p_event_id: eventId, p_action: action });
  if (error) return toFailure(error, "Mise à jour du minuteur") as Extract<CravingWriteResult, { ok: false }>;
  const timer = data as { startedAt: string; pausedAt: string | null; pausedSeconds: number; completedAt: string | null };
  return { ok: true, timer };
}

export async function completeCravingEvent(eventId: string, payload: CompleteCravingPayload): Promise<CravingWriteResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_craving_event", {
    p_event_id: eventId,
    payload: payload as unknown as Json,
  });
  return error ? toFailure(error, "Fin du moment") : { ok: true };
}

export async function dismissCravingEvent(eventId: string): Promise<CravingWriteResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("dismiss_craving_event", { p_event_id: eventId });
  return error ? toFailure(error, "Mise de côté du moment") : { ok: true };
}
