import { CUSTOM_STRATEGY, STRATEGY_MIN_COMPLETED } from "@/features/craving/constants";
import { formatDecimal, pluralize } from "@/features/progress/format";

/*
 * Logique pure du mode envie (Sprint 7) : minuteur fondé sur des horodatages
 * (ADR-060), étape courante, variation d'envie et analyse des stratégies (ADR-061).
 * Aucune interprétation médicale : un score décrit une intensité ressentie (ADR-063).
 */

// ---------------------------------------------------------------------------
// Minuteur
// ---------------------------------------------------------------------------

export type TimerSnapshot = {
  /** Début de l'intervention (ISO, horloge serveur) */
  startedAt: string;
  /** Début de la pause en cours (ISO) ou null */
  pausedAt: string | null;
  /** Secondes de pause déjà cumulées */
  pausedSeconds: number;
  /** Durée prévue en minutes (null = sans minuteur) */
  plannedMinutes: number | null;
};

export type TimerState = {
  /** Temps actif écoulé (hors pauses), en secondes */
  elapsedSeconds: number;
  /** Temps restant (null sans minuteur) */
  remainingSeconds: number | null;
  paused: boolean;
  expired: boolean;
};

/**
 * Calcule l'état du minuteur à l'instant `nowMs` à partir des horodatages persistés.
 * Rien n'est décrémenté localement : un rafraîchissement, un changement d'onglet ou
 * une mise en veille ne perdent pas le minuteur.
 */
export function getTimerState(snapshot: TimerSnapshot, nowMs: number): TimerState {
  const started = Date.parse(snapshot.startedAt);
  const reference = snapshot.pausedAt ? Date.parse(snapshot.pausedAt) : nowMs;
  const elapsedSeconds = Math.max(0, Math.floor((reference - started) / 1000) - snapshot.pausedSeconds);

  if (snapshot.plannedMinutes === null) {
    return { elapsedSeconds, remainingSeconds: null, paused: snapshot.pausedAt !== null, expired: false };
  }
  const total = snapshot.plannedMinutes * 60;
  const remainingSeconds = Math.max(0, total - elapsedSeconds);
  return {
    elapsedSeconds: Math.min(elapsedSeconds, total),
    remainingSeconds,
    paused: snapshot.pausedAt !== null,
    expired: remainingSeconds === 0,
  };
}

/** « 09:42 » (minutes:secondes). */
export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Durée approximative lisible : « moins d'une minute », « 10 min », « 1 h 05 ». */
export function formatApproxDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return "moins d'une minute";
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${String(minutes % 60).padStart(2, "0")}`;
}

/** Libellé d'une durée mesurée : « moins d'une minute » ou « environ 10 min » (jamais « environ moins… »). */
export function formatMeasuredDuration(totalSeconds: number): string {
  return totalSeconds < 60 ? formatApproxDuration(totalSeconds) : `environ ${formatApproxDuration(totalSeconds)}`;
}

// ---------------------------------------------------------------------------
// Étape courante (reprise après rafraîchissement)
// ---------------------------------------------------------------------------

export type CravingPhaseInput = {
  status: "in_progress" | "completed" | "abandoned";
  intervention: { completedAt: string | null } | null;
};

export type CravingPhase =
  /** Choisir une stratégie */
  | "strategy"
  /** Intervention en cours (minuteur ou sans minuteur) */
  | "active"
  /** Réévaluer l'envie */
  | "reevaluate"
  /** Moment enregistré */
  | "done"
  /** Moment mis de côté ou expiré */
  | "closed";

export function getCravingPhase(event: CravingPhaseInput): CravingPhase {
  if (event.status === "completed") return "done";
  if (event.status === "abandoned") return "closed";
  if (!event.intervention) return "strategy";
  return event.intervention.completedAt ? "reevaluate" : "active";
}

// ---------------------------------------------------------------------------
// Variation d'envie
// ---------------------------------------------------------------------------

/**
 * Réduction de l'envie : initial − final. POSITIVE = diminution, négative = hausse,
 * 0 = inchangée. Terminologie unique dans tout le code.
 */
export function calculateCravingReduction(initial: number, final: number): number {
  return initial - final;
}

export type CravingChange = "decrease" | "same" | "increase";

export function getCravingChange(initial: number, final: number): CravingChange {
  const reduction = calculateCravingReduction(initial, final);
  if (reduction > 0) return "decrease";
  return reduction < 0 ? "increase" : "same";
}

/** Phrase de résultat : descriptive, jamais « excellent » ni « échec ». */
export function describeCravingResult(initial: number, final: number): string {
  switch (getCravingChange(initial, final)) {
    case "decrease":
      return `Ton envie est passée de ${initial}/10 à ${final}/10 pendant cette intervention.`;
    case "same":
      return `Ton envie est restée à ${final}/10. Merci d'avoir pris le temps de l'observer.`;
    case "increase":
      return `Ton envie est plus forte qu'au début de l'intervention (${initial}/10, puis ${final}/10).`;
  }
}

/** « 8 → 5 » et l'écart en points : « −3 points », « +2 points », « 0 point ». */
export function formatCravingDelta(initial: number, final: number): string {
  const change = final - initial;
  const sign = change > 0 ? "+" : change < 0 ? "−" : "";
  const magnitude = Math.abs(change);
  return `${sign}${magnitude} ${magnitude >= 2 ? "points" : "point"}`;
}

// ---------------------------------------------------------------------------
// Analyse des stratégies
// ---------------------------------------------------------------------------

export type CompletedIntervention = {
  initial: number;
  final: number;
  /** Slug du catalogue, ou CUSTOM_STRATEGY pour une stratégie personnelle */
  strategyKey: string;
};

export type StrategyEffectiveness = {
  strategyKey: string;
  count: number;
  /** Réduction moyenne (initial − final) ; positive = diminution */
  averageReduction: number;
};

/**
 * Moyenne de (initial − final) par stratégie, uniquement pour les moments TERMINÉS,
 * et seulement pour les stratégies utilisées au moins `STRATEGY_MIN_COMPLETED` fois.
 * Tri : réduction moyenne décroissante. Les stratégies personnelles sont regroupées.
 */
export function calculateStrategyEffectiveness(
  interventions: readonly CompletedIntervention[],
  minCompleted: number = STRATEGY_MIN_COMPLETED,
): StrategyEffectiveness[] {
  const groups = new Map<string, number[]>();
  for (const item of interventions) {
    groups.set(item.strategyKey, [...(groups.get(item.strategyKey) ?? []), calculateCravingReduction(item.initial, item.final)]);
  }
  return [...groups.entries()]
    .filter(([, reductions]) => reductions.length >= minCompleted)
    .map(([strategyKey, reductions]) => ({
      strategyKey,
      count: reductions.length,
      averageReduction: reductions.reduce((sum, value) => sum + value, 0) / reductions.length,
    }))
    .sort((a, b) => b.averageReduction - a.averageReduction || b.count - a.count || a.strategyKey.localeCompare(b.strategyKey));
}

/** Phrase descriptive pour une stratégie : jamais « ta meilleure stratégie ». */
export function describeStrategyEffectiveness(item: StrategyEffectiveness, name: string): string {
  const rounded = Math.round(item.averageReduction * 10) / 10;
  const count = `${item.count} ${pluralize(item.count, "intervention", "interventions")}`;
  const subject = item.strategyKey === CUSTOM_STRATEGY ? "une stratégie personnelle" : `« ${name} »`;
  if (rounded > 0) {
    return `Lors de tes ${count} avec ${subject}, ton envie a diminué en moyenne de ${formatDecimal(rounded)} ${rounded >= 2 ? "points" : "point"}.`;
  }
  if (rounded < 0) {
    return `Lors de tes ${count} avec ${subject}, ton envie a augmenté en moyenne de ${formatDecimal(-rounded)} ${-rounded >= 2 ? "points" : "point"}.`;
  }
  return `Lors de tes ${count} avec ${subject}, ton envie est restée en moyenne au même niveau.`;
}
