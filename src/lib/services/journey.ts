import "server-only";

import { cache } from "react";

import type { Motivation, SubstanceGoal } from "@/features/onboarding/constants";
import { createClient } from "@/lib/supabase/server";

/*
 * Lecture du parcours de l'utilisateur connecté. La RLS limite chaque requête
 * aux lignes de l'utilisateur ; le filtre explicite sur user_id rend l'intention claire.
 */

export type TrackedSubstance = {
  id: string;
  slug: string;
  name: string;
  customName: string | null;
  goal: SubstanceGoal;
  startedOn: string;
  isPrimary: boolean;
};

/** Substances actives suivies, la principale en premier. */
export const getTrackedSubstances = cache(async (userId: string): Promise<TrackedSubstance[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_substances")
    .select("id, custom_name, goal, started_on, is_primary, substances ( slug, name_fr, sort_order )")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("is_primary", { ascending: false })
    .order("created_at");

  if (error) {
    console.error("[journey] Lecture des substances suivies impossible", { code: error.code });
    throw new Error("Le parcours n'a pas pu être chargé.");
  }

  return data.map((row) => ({
    id: row.id,
    slug: row.substances.slug,
    name: row.substances.name_fr,
    customName: row.custom_name,
    goal: row.goal,
    startedOn: row.started_on,
    isPrimary: row.is_primary,
  }));
});

/** Motivations choisies (utilisées par « Mon plan », Sprint 8). */
export async function getUserMotivations(
  userId: string,
): Promise<{ motivation: Motivation; customLabel: string | null }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_motivations")
    .select("motivation, custom_label")
    .eq("user_id", userId)
    .order("created_at");

  if (error) {
    console.error("[journey] Lecture des motivations impossible", { code: error.code });
    throw new Error("Les motivations n'ont pas pu être chargées.");
  }
  return data.map((row) => ({ motivation: row.motivation, customLabel: row.custom_label }));
}

/** Raison principale : la plus récente (une seule en V1). */
export async function getPrimaryReason(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("personal_reasons")
    .select("reason_text")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[journey] Lecture de la raison impossible", { code: error.code });
    throw new Error("La raison n'a pas pu être chargée.");
  }
  return data?.reason_text ?? null;
}

export type SupportContact = {
  id: string;
  name: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
};

/** Personnes de soutien (données privées de tiers). */
export async function getSupportContacts(userId: string): Promise<SupportContact[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("support_contacts")
    .select("id, name, relationship, phone, email")
    .eq("user_id", userId)
    .order("created_at");

  if (error) {
    console.error("[journey] Lecture des contacts impossible", { code: error.code });
    throw new Error("Les contacts n'ont pas pu être chargés.");
  }
  return data;
}
