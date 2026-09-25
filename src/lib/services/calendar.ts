import "server-only";

import type { CalendarEntry } from "@/features/calendar/logic";
import { createClient } from "@/lib/supabase/server";

/**
 * Journées d'une période pour le calendrier (ADR-047) : SEULEMENT la date, le statut
 * et l'état terminé / brouillon. Aucun score, texte, émotion ni consommation.
 * Une requête par vue (un mois ou une année), filtrée par la RLS et par user_id.
 */
export async function getCalendarEntries(userId: string, start: string, end: string): Promise<CalendarEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_checkins")
    .select("checkin_date, status, completed_at")
    .eq("user_id", userId)
    .gte("checkin_date", start)
    .lte("checkin_date", end)
    .order("checkin_date");

  if (error) {
    console.error("[calendar] Lecture impossible", { code: error.code });
    throw new Error("Le calendrier n'a pas pu être chargé.");
  }

  return data.map((row) => ({ date: row.checkin_date, status: row.status, completed: row.completed_at !== null }));
}

/** Vrai si l'utilisateur a au moins un check-in terminé (état vide du calendrier). */
export async function hasAnyCompletedCheckin(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("daily_checkins")
    .select("checkin_date", { count: "exact", head: true })
    .eq("user_id", userId)
    .not("completed_at", "is", null);

  if (error) {
    console.error("[calendar] Comptage impossible", { code: error.code });
    throw new Error("Le calendrier n'a pas pu être chargé.");
  }
  return (count ?? 0) > 0;
}
