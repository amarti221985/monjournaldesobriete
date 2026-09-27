import "server-only";

import { cache } from "react";

import type {
  AchievementDefinition,
  AchievementStats,
  AwardedAchievement,
  EarnedAchievement,
} from "@/features/achievements/logic";
import { createClient } from "@/lib/supabase/server";

/*
 * Accomplissements (Sprint 9). L'attribution est faite UNIQUEMENT par la base
 * (award_achievements, SECURITY DEFINER sans paramètre) : le navigateur ne peut jamais
 * choisir un accomplissement ni sa date. Métriques calculées à la volée, jamais persistées.
 */

export const getAchievementDefinitions = cache(async (): Promise<AchievementDefinition[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("achievement_definitions")
    .select("slug, category, metric, threshold, is_quantitative, name_fr, description_fr, icon_key, sort_order")
    .order("sort_order");
  if (error) {
    console.error("[achievements] Lecture du catalogue impossible", { code: error.code });
    throw new Error("Le catalogue n'a pas pu être chargé.");
  }
  return data.map((row) => ({
    slug: row.slug,
    category: row.category,
    metric: row.metric,
    threshold: row.threshold,
    isQuantitative: row.is_quantitative,
    name: row.name_fr,
    description: row.description_fr,
    iconKey: row.icon_key,
    sortOrder: row.sort_order,
  }));
});

/** Accomplissements obtenus, les plus récents d'abord. */
export async function getEarnedAchievements(userId: string, limit?: number): Promise<EarnedAchievement[]> {
  const supabase = await createClient();
  let query = supabase
    .from("user_achievements")
    .select("earned_at, metadata, achievement_definitions ( slug )")
    .eq("user_id", userId)
    .order("earned_at", { ascending: false });
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) {
    console.error("[achievements] Lecture des accomplissements impossible", { code: error.code });
    throw new Error("Les accomplissements n'ont pas pu être chargés.");
  }
  return data.map((row) => {
    const metadata = row.metadata as { date_source?: string } | null;
    return {
      slug: row.achievement_definitions.slug,
      earnedAt: row.earned_at,
      dateSource: metadata?.date_source === "attribution" ? "attribution" : "exact",
    };
  });
}

export async function countEarnedAchievements(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("user_achievements")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) {
    console.error("[achievements] Comptage impossible", { code: error.code });
    throw new Error("Les accomplissements n'ont pas pu être chargés.");
  }
  return count ?? 0;
}

/** Valeurs actuelles des métriques de l'utilisateur connecté (une seule requête). */
export async function getAchievementProgress(): Promise<AchievementStats> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_achievement_progress");
  if (error) {
    console.error("[achievements] Lecture de la progression impossible", { code: error.code });
    throw new Error("La progression n'a pas pu être chargée.");
  }
  return (data ?? {}) as AchievementStats;
}

export type AwardResult = { awarded: AwardedAchievement[]; initial: boolean };

const EMPTY_AWARD: AwardResult = { awarded: [], initial: false };

/**
 * Évaluation idempotente (points d'évaluation intentionnels : fin de check-in, fin de
 * moment d'envie, modification du plan, ouverture de /achievements). Ne bloque jamais
 * l'action principale : en cas d'erreur, rien n'est attribué et rien n'est affiché.
 */
export async function awardAchievements(): Promise<AwardResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("award_achievements");
    if (error) {
      console.error("[achievements] Attribution impossible", { code: error.code });
      return EMPTY_AWARD;
    }
    const result = data as { awarded: { slug: string }[]; initial: boolean };
    if (result.awarded.length === 0) return { awarded: [], initial: result.initial };
    const definitions = await getAchievementDefinitions();
    const bySlug = new Map(definitions.map((definition) => [definition.slug, definition]));
    return {
      initial: result.initial,
      awarded: result.awarded.flatMap(({ slug }) => {
        const definition = bySlug.get(slug);
        return definition ? [{ slug, name: definition.name, description: definition.description }] : [];
      }),
    };
  } catch {
    return EMPTY_AWARD;
  }
}
