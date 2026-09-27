import {
  BookOpen,
  CalendarCheck,
  Compass,
  Footprints,
  HeartHandshake,
  Leaf,
  Lightbulb,
  Mail,
  Map,
  MapPin,
  MessageSquare,
  Search,
  Star,
  Sunrise,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { Database } from "@/types/database";

/*
 * Accomplissements (Sprint 9). Le catalogue (slug, métrique, seuil, libellés) vit en base
 * (achievement_definitions) ; ici, seulement la présentation. Aucune pièce, XP, niveau ni
 * classement (ADR-074).
 */

export type AchievementCategory = Database["public"]["Enums"]["achievement_category"];

export const ACHIEVEMENT_CATEGORIES = [
  "sobriety",
  "consistency",
  "reflection",
  "understanding",
  "action",
  "plan",
] as const satisfies readonly AchievementCategory[];

export const categoryLabels: Record<AchievementCategory, { label: string; description: string }> = {
  sobriety: { label: "Sobriété", description: "Tes journées sobres enregistrées, au total et dans une même série." },
  consistency: { label: "Constance", description: "Les moments où tu as pris le temps de faire le point." },
  reflection: { label: "Réflexion", description: "Ce que tu as écrit pour mieux te comprendre." },
  understanding: { label: "Compréhension", description: "Les journées où tu as observé ce qui se passait en toi." },
  action: { label: "Action", description: "Les moments d'envie où tu as utilisé tes outils, quel qu'en soit le résultat." },
  plan: { label: "Mon plan", description: "Ce que tu as préparé pour t'accompagner." },
};

/** Clés d'icônes stables stockées en base → icônes Lucide (aucun composant en base). */
export const achievementIcons: Record<string, LucideIcon> = {
  leaf: Leaf,
  sunrise: Sunrise,
  "trending-up": TrendingUp,
  "calendar-check": CalendarCheck,
  "book-open": BookOpen,
  star: Star,
  search: Search,
  lightbulb: Lightbulb,
  footprints: Footprints,
  compass: Compass,
  "heart-handshake": HeartHandshake,
  map: Map,
  users: Users,
  "map-pin": MapPin,
  "message-square": MessageSquare,
  mail: Mail,
};

/** Progression lisible, sans pression : « 42 journées sobres enregistrées sur 60 ». */
export const metricProgressLabels: Record<string, (current: number, threshold: number) => string> = {
  sober_days: (c, t) => `${c} ${c > 1 ? "journées sobres enregistrées" : "journée sobre enregistrée"} sur ${t}`,
  best_streak: (c, t) => `Meilleure série enregistrée : ${c} sur ${t}`,
  checkins: (c, t) => `${c} ${c > 1 ? "check-ins complétés" : "check-in complété"} sur ${t}`,
  reflection_days: (c, t) => `${c} ${c > 1 ? "réflexions" : "réflexion"} sur ${t}`,
  victory_days: (c, t) => `${c} ${c > 1 ? "victoires" : "victoire"} sur ${t}`,
  trigger_days: (c, t) => `${c} ${c > 1 ? "journées" : "journée"} avec déclencheur identifié sur ${t}`,
  emotion_days: (c, t) => `${c} ${c > 1 ? "journées" : "journée"} avec émotion nommée sur ${t}`,
  craving_interventions: (c, t) => `${c} ${c > 1 ? "interventions" : "intervention"} sur ${t}`,
  strategies_tried: (c, t) => `${c} ${c > 1 ? "stratégies essayées" : "stratégie essayée"} sur ${t}`,
  plan_motivations: (c, t) => `${c} ${c > 1 ? "motivations" : "motivation"} sur ${t}`,
  plan_triggers: (c, t) => `${c} ${c > 1 ? "déclencheurs personnels" : "déclencheur personnel"} sur ${t}`,
  plan_strategies: (c, t) => `${c} ${c > 1 ? "stratégies personnelles" : "stratégie personnelle"} sur ${t}`,
  plan_elements: (c, t) => `${c} ${c > 1 ? "éléments" : "élément"} sur ${t}`,
};

export const RECENT_ACHIEVEMENTS_LIMIT = 3;
export const NEXT_STEPS_LIMIT = 3;
