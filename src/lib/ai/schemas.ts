import { z } from "zod";

/*
 * Sortie structurée d'un bilan (ADR-087). Deux niveaux :
 * - `weeklyReflectionModelSchema` : forme demandée au fournisseur (sortie structurée) ;
 * - `weeklyReflectionSchema` : validation STRICTE de l'application (tailles, nombres
 *   d'éléments, clés de justification connues) avant toute persistance.
 */

/** Clés de justification autorisées : renvoient à des champs du jeu de données, jamais à du texte copié. */
export const EVIDENCE_KEYS = [
  "tracked_days",
  "sober_days",
  "sober_with_craving_days",
  "consumption_days",
  "average_mood",
  "average_energy",
  "average_stress",
  "average_craving",
  "frequent_emotions",
  "frequent_triggers",
  "frequent_achievements",
  "craving_interventions",
  "strategies_used",
  "achievements_unlocked",
  "reflections",
  "consumption_context",
  "craving_context",
] as const;

export type EvidenceKey = (typeof EVIDENCE_KEYS)[number];

const observationModel = z.object({ text: z.string(), evidence_keys: z.array(z.string()) });

export const weeklyReflectionModelSchema = z.object({
  summary: z.string(),
  progress: z.array(observationModel),
  recurring_themes: z.array(observationModel),
  difficult_moments: z.array(observationModel),
  strengths: z.array(observationModel),
  reflection_questions: z.array(z.string()),
});

const observation = z.object({
  text: z.string().trim().min(8).max(320),
  evidence_keys: z.array(z.enum(EVIDENCE_KEYS)).max(6),
});

export const weeklyReflectionSchema = z.object({
  summary: z.string().trim().min(20).max(900),
  progress: z.array(observation).max(3),
  recurring_themes: z.array(observation).max(3),
  difficult_moments: z.array(observation).max(3),
  strengths: z.array(observation).max(3),
  reflection_questions: z.array(z.string().trim().min(8).max(240)).min(2).max(3),
});

export type WeeklyReflection = z.infer<typeof weeklyReflectionSchema>;
