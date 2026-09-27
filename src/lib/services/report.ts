import "server-only";

import type { ReportOptions } from "@/features/reports/options";
import { createClient } from "@/lib/supabase/server";

/*
 * Données du rapport imprimable « Mon parcours » (Sprint 12, ADR-088). Requêtes
 * structurées en parallèle (relations embarquées, aucun N+1), limitées à l'utilisateur
 * connecté (filtre user_id + RLS). JAMAIS lus : la lettre à soi-même et les coordonnées
 * des personnes de soutien. Les sections sensibles ne sont lues que si l'option est active.
 */

type Named = { name_fr: string } | null;
type Labelled = { name_fr: string } | null;

export type ReportCheckin = {
  checkin_date: string;
  status: "sober" | "sober_with_craving" | "consumed";
  mood_score: number | null;
  energy_score: number | null;
  stress_score: number | null;
  craving_score: number | null;
  victory_text: string | null;
  proud_of_text: string | null;
  lesson_text: string | null;
  tomorrow_intention_text: string | null;
  notes: string | null;
  checkin_emotions: { emotions: Labelled }[];
  checkin_triggers: { custom_label: string | null; trigger_types: Labelled }[];
  consumption_events: {
    quantity: number | null;
    unit: string | null;
    occurred_at: string | null;
    craving_before: number | null;
    context_text: string | null;
    reflection_text: string | null;
    next_time_strategy_text: string | null;
    user_substances: { custom_name: string | null; substances: Named } | null;
  }[];
};

export type ReportCraving = {
  local_date: string;
  initial_craving_score: number;
  final_craving_score: number | null;
  context_text: string | null;
  craving_interventions:
    | ReportIntervention
    | ReportIntervention[]
    | null;
};

type ReportIntervention = {
  custom_strategy_text: string | null;
  actual_duration_seconds: number | null;
  craving_strategies: Labelled;
};

export type ReportData = {
  checkins: ReportCheckin[];
  cravings: ReportCraving[];
  completedInterventions: number;
  plan: {
    reason: string | null;
    motivations: { motivation: string; custom_label: string | null }[];
    triggers: { custom_label: string | null; notes: string | null; trigger_types: Labelled }[];
    strategies: { custom_name: string | null; notes: string | null; craving_strategies: Labelled }[];
    reminder: string | null;
  } | null;
  aiReflections: { period_start: string; period_end: string; summary: string; content: unknown }[];
};

function check<T>(result: { data: T | null; error: { code: string } | null }, scope: string): T {
  if (result.error) {
    console.error(`[report] ${scope} impossible`, { code: result.error.code });
    throw new Error("Le rapport n'a pas pu être préparé.");
  }
  return result.data as T;
}

export async function collectReportData(
  userId: string,
  range: { start: string; end: string },
  options: ReportOptions,
  aiEnabled: boolean,
): Promise<ReportData> {
  const supabase = await createClient();
  const consumptionSelect = options.includeConsumption
    ? `, consumption_events ( quantity, unit, occurred_at, craving_before, context_text, reflection_text,
         next_time_strategy_text, user_substances ( custom_name, substances ( name_fr ) ) )`
    : "";

  const [checkins, cravings, interventions, reason, motivations, triggers, strategies, reminder, reflections] = await Promise.all([
    supabase
      .from("daily_checkins")
      .select(
        `checkin_date, status, mood_score, energy_score, stress_score, craving_score, victory_text, proud_of_text,
         lesson_text, tomorrow_intention_text, notes,
         checkin_emotions ( emotions ( name_fr ) ),
         checkin_triggers ( custom_label, trigger_types ( name_fr ) )${consumptionSelect}`,
      )
      .eq("user_id", userId)
      .not("completed_at", "is", null)
      .gte("checkin_date", range.start)
      .lte("checkin_date", range.end)
      .order("checkin_date"),
    options.includeCravings
      ? supabase
          .from("craving_events")
          .select(
            `local_date, initial_craving_score, final_craving_score, context_text,
             craving_interventions ( custom_strategy_text, actual_duration_seconds, craving_strategies ( name_fr ) )`,
          )
          .eq("user_id", userId)
          .eq("status", "completed")
          .gte("local_date", range.start)
          .lte("local_date", range.end)
          .order("started_at")
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("craving_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("local_date", range.start)
      .lte("local_date", range.end),
    options.includePlan
      ? supabase.from("personal_reasons").select("reason_text").eq("user_id", userId).order("created_at", { ascending: false }).limit(1)
      : Promise.resolve({ data: [], error: null }),
    options.includePlan
      ? supabase.from("user_motivations").select("motivation, custom_label").eq("user_id", userId).order("created_at")
      : Promise.resolve({ data: [], error: null }),
    options.includePlan
      ? supabase
          .from("user_personal_triggers")
          .select("custom_label, notes, trigger_types ( name_fr )")
          .eq("user_id", userId)
          .eq("is_active", true)
          .order("created_at")
      : Promise.resolve({ data: [], error: null }),
    options.includePlan
      ? supabase
          .from("user_personal_strategies")
          .select("custom_name, notes, craving_strategies ( name_fr )")
          .eq("user_id", userId)
          .eq("is_active", true)
          .order("created_at")
      : Promise.resolve({ data: [], error: null }),
    options.includePlan
      ? supabase.from("personal_reminders").select("content").eq("user_id", userId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    options.includeAi && aiEnabled
      ? supabase
          .from("ai_reflections")
          .select("period_start, period_end, summary, content")
          .eq("user_id", userId)
          .gte("period_end", range.start)
          .lte("period_end", range.end)
          .order("period_end")
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (interventions.error) check(interventions, "Comptage des interventions");

  return {
    checkins: (check(checkins, "Lecture des check-ins") ?? []).map((row) => ({
      ...(row as unknown as ReportCheckin),
      consumption_events: (row as unknown as Partial<ReportCheckin>).consumption_events ?? [],
    })),
    cravings: (check(cravings, "Lecture des moments d'envie") ?? []) as unknown as ReportCraving[],
    completedInterventions: interventions.count ?? 0,
    plan: options.includePlan
      ? {
          reason: (check(reason, "Lecture de la raison") as { reason_text: string }[])[0]?.reason_text ?? null,
          motivations: check(motivations, "Lecture des motivations") as { motivation: string; custom_label: string | null }[],
          triggers: check(triggers, "Lecture des déclencheurs") as unknown as NonNullable<ReportData["plan"]>["triggers"],
          strategies: check(strategies, "Lecture des stratégies") as unknown as NonNullable<ReportData["plan"]>["strategies"],
          reminder: (check(reminder, "Lecture du rappel") as { content: string } | null)?.content ?? null,
        }
      : null,
    aiReflections: (check(reflections, "Lecture des bilans") ?? []) as ReportData["aiReflections"],
  };
}
