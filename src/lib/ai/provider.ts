import type { WeeklyInsightDataset } from "@/lib/ai/dataset";

/*
 * Abstraction du fournisseur d'IA (ADR-083). L'interface ne connaît que le jeu de données
 * minimisé et renvoie une sortie brute (validée ensuite par les garde-fous). Changer de
 * fournisseur = fournir une autre implémentation, sans toucher à l'interface utilisateur.
 */

export type ProviderOutcome =
  | { ok: true; output: unknown }
  | { ok: false; reason: "refusal" | "timeout" | "unavailable" | "invalid_output" | "error" };

export interface AiProvider {
  /** Identifiant technique (audit), jamais une clé */
  readonly name: string;
  readonly model: string;
  generateWeeklyReflection(dataset: WeeklyInsightDataset): Promise<ProviderOutcome>;
}
