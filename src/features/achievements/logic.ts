import {
  ACHIEVEMENT_CATEGORIES,
  metricProgressLabels,
  NEXT_STEPS_LIMIT,
  type AchievementCategory,
} from "@/features/achievements/constants";

/*
 * Logique pure des accomplissements (Sprint 9). Les métriques (valeurs actuelles) sont
 * calculées en base (get_achievement_progress, mêmes définitions que les Sprints 4 et 7) ;
 * l'attribution est faite par la base (award_achievements). Ici : quels critères sont
 * satisfaits, progression, prochaines étapes et notifications. Un accomplissement obtenu
 * reste obtenu : l'état actuel ne retire jamais rien (ADR-069).
 */

export type AchievementDefinition = {
  slug: string;
  category: AchievementCategory;
  metric: string;
  threshold: number;
  isQuantitative: boolean;
  name: string;
  description: string;
  iconKey: string | null;
  sortOrder: number;
};

/** Valeurs actuelles des métriques (absence = 0). */
export type AchievementStats = Record<string, number>;

export type EarnedAchievement = { slug: string; earnedAt: string; dateSource: "exact" | "attribution" };

export type AchievementStatus =
  /** Obtenu (événement historique persisté) */
  | "earned"
  /** Critère atteint mais pas encore enregistré (corrigé par la prochaine évaluation) */
  | "reached"
  | "in_progress"
  | "not_started";

export type AchievementView = {
  definition: AchievementDefinition;
  status: AchievementStatus;
  /** Valeur affichée, jamais au-delà du seuil */
  current: number;
  earnedAt: string | null;
  dateSource: EarnedAchievement["dateSource"] | null;
};

const valueOf = (stats: AchievementStats, metric: string) => Math.max(0, Math.floor(stats[metric] ?? 0));

/** Critère satisfait : valeur actuelle ≥ seuil. Source unique de la comparaison côté application. */
export function isSatisfied(definition: AchievementDefinition, stats: AchievementStats): boolean {
  return valueOf(stats, definition.metric) >= definition.threshold;
}

export function evaluateAchievements(definitions: readonly AchievementDefinition[], stats: AchievementStats): AchievementDefinition[] {
  return definitions.filter((definition) => isSatisfied(definition, stats));
}

const byCategory = (category: AchievementCategory) => (definitions: readonly AchievementDefinition[], stats: AchievementStats) =>
  evaluateAchievements(
    definitions.filter((definition) => definition.category === category),
    stats,
  );

export const evaluateSobrietyAchievements = byCategory("sobriety");
export const evaluateCheckinAchievements = byCategory("consistency");
export const evaluateReflectionAchievements = byCategory("reflection");
export const evaluateUnderstandingAchievements = byCategory("understanding");
export const evaluateCravingAchievements = byCategory("action");
export const evaluatePlanAchievements = byCategory("plan");

/** État de chaque accomplissement : obtenu (persisté) prime toujours sur l'état actuel. */
export function buildAchievementViews(
  definitions: readonly AchievementDefinition[],
  stats: AchievementStats,
  earned: readonly EarnedAchievement[],
): AchievementView[] {
  const earnedBySlug = new Map(earned.map((item) => [item.slug, item]));
  return [...definitions]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((definition) => {
      const earnedItem = earnedBySlug.get(definition.slug);
      const value = valueOf(stats, definition.metric);
      const current = Math.min(value, definition.threshold);
      let status: AchievementStatus;
      if (earnedItem) status = "earned";
      else if (value >= definition.threshold) status = "reached";
      else status = value > 0 ? "in_progress" : "not_started";
      return {
        definition,
        status,
        current: earnedItem ? definition.threshold : current,
        earnedAt: earnedItem?.earnedAt ?? null,
        dateSource: earnedItem?.dateSource ?? null,
      };
    });
}

export function groupByCategory(views: readonly AchievementView[]): { category: AchievementCategory; views: AchievementView[] }[] {
  return ACHIEVEMENT_CATEGORIES.map((category) => ({
    category,
    views: views.filter((view) => view.definition.category === category),
  })).filter((group) => group.views.length > 0);
}

/**
 * Prochaines étapes (règle simple et transparente) : accomplissements quantitatifs non
 * obtenus, déjà commencés, les plus proches de leur seuil (ratio), au plus UN par
 * catégorie pour diversifier, `limit` au total.
 */
export function selectNextSteps(views: readonly AchievementView[], limit: number = NEXT_STEPS_LIMIT): AchievementView[] {
  const candidates = views
    .filter((view) => view.status === "in_progress" && view.definition.isQuantitative)
    .sort(
      (a, b) =>
        b.current / b.definition.threshold - a.current / a.definition.threshold ||
        a.definition.threshold - b.definition.threshold ||
        a.definition.sortOrder - b.definition.sortOrder,
    );
  const picked: AchievementView[] = [];
  const categories = new Set<AchievementCategory>();
  for (const view of candidates) {
    if (categories.has(view.definition.category)) continue;
    // Une seule étape par métrique : la plus proche (seuil le plus bas non atteint).
    if (picked.some((item) => item.definition.metric === view.definition.metric)) continue;
    picked.push(view);
    categories.add(view.definition.category);
    if (picked.length === limit) break;
  }
  return picked;
}

/** Prochain jalon d'une métrique (ex. participation : prochain seuil de check-ins). */
export function nextMilestoneFor(views: readonly AchievementView[], metric: string): AchievementView | null {
  return (
    views
      .filter((view) => view.definition.metric === metric && view.status !== "earned" && view.status !== "reached")
      .sort((a, b) => a.definition.threshold - b.definition.threshold)[0] ?? null
  );
}

/** Texte de progression : « 42 journées sobres enregistrées sur 60 ». */
export function progressLabel(view: AchievementView): string {
  const label = metricProgressLabels[view.definition.metric];
  return label ? label(view.current, view.definition.threshold) : `${view.current} sur ${view.definition.threshold}`;
}

/** Date d'obtention dans le fuseau du profil (timestamps UTC en base). */
export function formatEarnedDate(earnedAt: string, timeZone: string): string {
  return new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "long", year: "numeric", timeZone }).format(new Date(earnedAt));
}

// ---------------------------------------------------------------------------
// Notification discrète
// ---------------------------------------------------------------------------

export type AwardedAchievement = { slug: string; name: string; description: string };

export type AchievementNotification =
  | { kind: "single"; achievement: AwardedAchievement }
  | { kind: "multiple"; count: number; achievements: AwardedAchievement[] }
  /** Rattrapage de l'historique : une seule synthèse, jamais 20 notifications */
  | { kind: "history"; count: number };

export function buildAchievementNotification(awarded: readonly AwardedAchievement[], initial: boolean): AchievementNotification | null {
  if (awarded.length === 0) return null;
  if (initial && awarded.length > 1) return { kind: "history", count: awarded.length };
  if (awarded.length === 1) return { kind: "single", achievement: awarded[0] };
  return { kind: "multiple", count: awarded.length, achievements: awarded.slice(0, 3) };
}
