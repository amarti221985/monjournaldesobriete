import "server-only";

import { cache } from "react";

import type { ProgressLabels } from "@/features/progress/progress-insights";
import type { ProgressCheckin } from "@/features/progress/types";
import { createClient } from "@/lib/supabase/server";

export type ProgressDataset = {
  checkins: ProgressCheckin[];
  labels: ProgressLabels;
  /** Nom affiché de chaque substance suivie mentionnée par un événement (id → nom) */
  substanceNames: Record<string, string>;
};

/**
 * Check-ins TERMINÉS de l'utilisateur, réduits aux colonnes utiles aux statistiques,
 * en UNE seule requête relationnelle (aucun N+1) : scores, statut, slugs et libellés
 * des déclencheurs / émotions / accomplissements, et la substance de chaque événement
 * de consommation. Aucun texte personnel (réflexions, notes, contexte, précisions
 * « Autre » des déclencheurs et accomplissements) ni quantité n'est lu ; seul le nom
 * de la substance suivie (celui que l'utilisateur a choisi) est affiché. Volume attendu :
 * quelques centaines de lignes par utilisateur (ADR-053). Mise en cache par requête
 * serveur uniquement (React cache), jamais partagée entre utilisateurs.
 */
export const getProgressDataset = cache(async (userId: string): Promise<ProgressDataset> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_checkins")
    .select(
      `checkin_date, status, mood_score, energy_score, stress_score, craving_score,
       checkin_triggers ( trigger_types ( slug, name_fr ) ),
       checkin_achievements ( achievement_types ( slug, name_fr ) ),
       checkin_emotions ( emotions ( slug, name_fr ) ),
       consumption_events ( user_substance_id, user_substances ( custom_name, substances ( name_fr ) ) )`,
    )
    .eq("user_id", userId)
    .not("completed_at", "is", null)
    .order("checkin_date");

  if (error) {
    console.error("[progress] Lecture des check-ins impossible", { code: error.code });
    throw new Error("La progression n'a pas pu être chargée.");
  }

  const labels: ProgressLabels = { triggers: {}, emotions: {}, achievements: {} };
  const substanceNames: Record<string, string> = {};

  const checkins = data.map((row): ProgressCheckin => {
    const triggers = row.checkin_triggers.map(({ trigger_types: item }) => {
      labels.triggers[item.slug] = item.name_fr;
      return item.slug;
    });
    const achievements = row.checkin_achievements.map(({ achievement_types: item }) => {
      labels.achievements[item.slug] = item.name_fr;
      return item.slug;
    });
    const emotions = row.checkin_emotions.map(({ emotions: item }) => {
      labels.emotions[item.slug] = item.name_fr;
      return item.slug;
    });
    const consumptionEvents = row.consumption_events.map((event) => {
      substanceNames[event.user_substance_id] =
        event.user_substances.custom_name?.trim() || event.user_substances.substances.name_fr;
      return { substanceId: event.user_substance_id };
    });

    return {
      date: row.checkin_date,
      status: row.status,
      mood: row.mood_score,
      energy: row.energy_score,
      stress: row.stress_score,
      craving: row.craving_score,
      triggers,
      achievements,
      emotions,
      consumptionEvents,
    };
  });

  return { checkins, labels, substanceNames };
});

/** Check-ins terminés pour le tableau de bord (même requête, même définition). */
export async function getCompletedCheckinsForProgress(userId: string): Promise<ProgressCheckin[]> {
  return (await getProgressDataset(userId)).checkins;
}
