import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import type { ExportSource } from "@/features/settings/export";
import { getSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

/*
 * Compte et contrôle des données (Sprint 11). L'utilisateur est TOUJOURS celui de la
 * session (auth.uid() côté base) : aucune fonction n'accepte un identifiant du navigateur
 * pour choisir le compte visé. Aucun contenu, courriel, mot de passe ni jeton n'est journalisé.
 */

export type AccountResult = { ok: true } | { ok: false; code: string | null };

function logFailure(scope: string, error: { code?: string | null; status?: number }) {
  console.error(`[account] ${scope} impossible`, { code: error.code ?? null, status: error.status ?? null });
}

/** Informations affichées dans Paramètres (jamais d'identifiant interne ni de jeton). */
export async function getAccountOverview(): Promise<{ email: string | null; createdAt: string | null; newEmail: string | null } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { email: data.user.email ?? null, createdAt: data.user.created_at ?? null, newEmail: data.user.new_email ?? null };
}

export async function updateDisplayName(userId: string, displayName: string): Promise<AccountResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").update({ display_name: displayName }).eq("id", userId).select("id");
  if (error) {
    logFailure("Nom d'affichage", error);
    return { ok: false, code: error.code };
  }
  return data.length > 0 ? { ok: true } : { ok: false, code: "not_found" };
}

/** Change le fuseau : les dates métier déjà enregistrées ne sont jamais réécrites (ADR-079). */
export async function updateTimezone(userId: string, timezone: string): Promise<AccountResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").update({ timezone }).eq("id", userId).select("id");
  if (error) {
    logFailure("Fuseau horaire", error);
    return { ok: false, code: error.code };
  }
  return data.length > 0 ? { ok: true } : { ok: false, code: "not_found" };
}

/**
 * Réauthentification : vérifie le mot de passe actuel avec un client ISOLÉ (aucun cookie,
 * aucune session conservée), puis ferme immédiatement la session de vérification.
 */
export async function verifyCurrentPassword(email: string, password: string): Promise<boolean> {
  const { url, publishableKey } = getSupabaseEnv();
  const verifier = createSupabaseClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await verifier.auth.signInWithPassword({ email, password });
  if (error || !data.session) return false;
  await verifier.auth.signOut({ scope: "local" }).catch(() => null);
  return true;
}

/** Flux officiel Supabase : un courriel de confirmation est envoyé (jamais d'écriture directe dans auth.users). */
export async function requestEmailChange(email: string, redirectTo: string): Promise<AccountResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: redirectTo });
  if (error) {
    logFailure("Changement de courriel", error);
    return { ok: false, code: error.code ?? null };
  }
  return { ok: true };
}

export async function changePassword(password: string): Promise<AccountResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    logFailure("Changement de mot de passe", error);
    return { ok: false, code: error.code ?? null };
  }
  return { ok: true };
}

/** Révoque les sessions des autres appareils (primitive Supabase `scope: "others"`). */
export async function signOutOtherSessions(): Promise<AccountResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) {
    logFailure("Déconnexion des autres appareils", error);
    return { ok: false, code: error.code ?? null };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

const SUBSTANCE = "user_substances ( custom_name, substances ( name_fr ) )";

/**
 * Toutes les données personnelles de l'utilisateur connecté, en requêtes parallèles
 * (relations embarquées, aucun N+1). Filtre user_id explicite + RLS.
 */
export async function collectExportData(userId: string): Promise<ExportSource> {
  const supabase = await createClient();
  const [auth, profile, substances, reasons, motivations, contacts, checkins, cravings, triggers, strategies, places, reminder, letter, achievements, aiPreferences, aiReflections, betaFeedback, productEvents] =
    await Promise.all([
      supabase.auth.getUser(),
      supabase.from("profiles").select("display_name, timezone, onboarding_completed, created_at").eq("id", userId).maybeSingle(),
      supabase
        .from("user_substances")
        .select("custom_name, goal, started_on, is_primary, is_active, created_at, substances ( name_fr )")
        .eq("user_id", userId)
        .order("created_at"),
      supabase.from("personal_reasons").select("reason_text, created_at, updated_at").eq("user_id", userId).order("created_at"),
      supabase.from("user_motivations").select("motivation, custom_label").eq("user_id", userId).order("created_at"),
      supabase.from("support_contacts").select("name, relationship, phone, email, is_primary").eq("user_id", userId).order("created_at"),
      supabase
        .from("daily_checkins")
        .select(
          `checkin_date, status, mood_score, energy_score, stress_score, craving_score, victory_text, proud_of_text,
           lesson_text, tomorrow_intention_text, notes, completed_at, created_at, updated_at,
           checkin_emotions ( emotions ( slug, name_fr ) ),
           checkin_triggers ( custom_label, trigger_types ( slug, name_fr ) ),
           checkin_achievements ( custom_label, achievement_types ( slug, name_fr ) ),
           consumption_events ( quantity, unit, occurred_at, craving_before, context_text, reflection_text,
             next_time_strategy_text, ${SUBSTANCE} )`,
        )
        .eq("user_id", userId)
        .order("checkin_date"),
      supabase
        .from("craving_events")
        .select(
          `local_date, status, initial_craving_score, final_craving_score, trigger_unknown, context_text, outcome_text,
           started_at, completed_at,
           craving_event_substances ( ${SUBSTANCE} ),
           craving_event_emotions ( emotions ( slug, name_fr ) ),
           craving_event_triggers ( custom_label, trigger_types ( slug, name_fr ) ),
           craving_interventions ( custom_strategy_text, helped_text, planned_duration_minutes, actual_duration_seconds,
             started_at, completed_at, craving_strategies ( slug, name_fr ) )`,
        )
        .eq("user_id", userId)
        .order("started_at"),
      supabase
        .from("user_personal_triggers")
        .select("custom_label, notes, is_active, trigger_types ( slug, name_fr )")
        .eq("user_id", userId)
        .order("created_at"),
      supabase
        .from("user_personal_strategies")
        .select("custom_name, notes, default_duration_minutes, is_favorite, is_active, craving_strategies ( slug, name_fr )")
        .eq("user_id", userId)
        .order("created_at"),
      supabase.from("safe_places").select("name, description, is_favorite, is_active").eq("user_id", userId).order("created_at"),
      supabase.from("personal_reminders").select("content, updated_at").eq("user_id", userId).maybeSingle(),
      supabase.from("self_letters").select("title, content, updated_at").eq("user_id", userId).maybeSingle(),
      supabase
        .from("user_achievements")
        .select("earned_at, achievement_definitions ( slug, name_fr, category )")
        .eq("user_id", userId)
        .order("earned_at"),
      supabase
        .from("ai_preferences")
        .select("ai_enabled, include_reflections, include_consumption_context, include_craving_context, consented_at, consent_version, revoked_at")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("ai_reflections")
        .select("period_start, period_end, type, summary, content, model, prompt_version, generated_at")
        .eq("user_id", userId)
        .order("period_end"),
      supabase.from("beta_feedback").select("category, message, page_context, created_at").eq("user_id", userId).order("created_at"),
      supabase.from("product_events").select("event_name, occurred_on").eq("user_id", userId).order("occurred_on"),
    ]);

  const failed = [profile, substances, reasons, motivations, contacts, checkins, cravings, triggers, strategies, places, reminder, letter, achievements, aiPreferences, aiReflections, betaFeedback, productEvents].find(
    (result) => result.error,
  );
  if (failed?.error) {
    logFailure("Export", failed.error);
    throw new Error("L'export n'a pas pu être préparé.");
  }

  return {
    account: { email: auth.data.user?.email ?? null, created_at: auth.data.user?.created_at ?? null },
    profile: profile.data,
    substances: substances.data ?? [],
    reasons: reasons.data ?? [],
    motivations: motivations.data ?? [],
    supportContacts: contacts.data ?? [],
    checkins: (checkins.data ?? []) as unknown as ExportSource["checkins"],
    cravingEvents: (cravings.data ?? []) as unknown as ExportSource["cravingEvents"],
    personalTriggers: triggers.data ?? [],
    personalStrategies: strategies.data ?? [],
    safePlaces: places.data ?? [],
    reminder: reminder.data,
    letter: letter.data,
    achievements: achievements.data ?? [],
    aiPreferences: aiPreferences.data,
    aiReflections: aiReflections.data ?? [],
    betaFeedback: betaFeedback.data ?? [],
    productEvents: productEvents.data ?? [],
  };
}

// ---------------------------------------------------------------------------
// Suppression du compte
// ---------------------------------------------------------------------------

/**
 * Supprime définitivement le compte connecté : RPC delete_my_account() (auth.uid(),
 * cascades dans la même transaction), puis nettoyage local de la session.
 */
export async function deleteCurrentAccount(): Promise<AccountResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_my_account");
  if (error) {
    logFailure("Suppression du compte", error);
    return { ok: false, code: error.code ?? null };
  }
  // Le compte n'existe plus : la session est retirée localement, puis les cookies
  // Supabase restants sont effacés par sécurité.
  await supabase.auth.signOut({ scope: "local" }).catch(() => null);
  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith("sb-")) cookieStore.delete(cookie.name);
  }
  return { ok: true };
}
