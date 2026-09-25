import type { CheckinStatus } from "@/features/checkin/constants";
import { isSoberStatus, sortByDate, type ProgressCheckin } from "@/features/progress/types";

/*
 * Métriques de progression (ADR-041, ADR-042).
 * Source de vérité : check-ins TERMINÉS uniquement. Une journée sans check-in est
 * inconnue : ni sobre, ni avec consommation, hors taux, n'ajoute rien à la série.
 */

export type SobrietyMetrics = {
  /** Jours suivis : check-ins terminés */
  trackedDays: number;
  /** Jours sobres : sober + sober_with_craving (ne revient jamais à zéro) */
  soberDays: number;
  /** Dont journées sobres malgré une forte envie */
  challengingDays: number;
  /** Jours avec consommation (une journée, quel que soit le nombre d'événements) */
  consumedDays: number;
  /** Taux de sobriété en % (jours sobres / jours suivis), null sans donnée */
  sobrietyRate: number | null;
};

/** Accepte toute liste de check-ins terminés (seul le statut est utilisé : tableau de bord, calendrier). */
export function calculateSobrietyMetrics(checkins: readonly { status: CheckinStatus }[]): SobrietyMetrics {
  let soberDays = 0;
  let challengingDays = 0;
  let consumedDays = 0;

  for (const checkin of checkins) {
    if (isSoberStatus(checkin.status)) soberDays += 1;
    if (checkin.status === "sober_with_craving") challengingDays += 1;
    if (checkin.status === "consumed") consumedDays += 1;
  }

  const trackedDays = checkins.length;
  return {
    trackedDays,
    soberDays,
    challengingDays,
    consumedDays,
    // Aucune donnée : pas de « 0 % » artificiel.
    sobrietyRate: trackedDays > 0 ? (soberDays / trackedDays) * 100 : null,
  };
}

export type StreakMetrics = {
  /** Journées sobres enregistrées depuis la dernière consommation enregistrée */
  current: number;
  /** Plus grand nombre de journées sobres enregistrées entre deux consommations enregistrées */
  best: number;
  /** Vrai si la dernière journée documentée est une journée avec consommation */
  lastDocumentedWasConsumption: boolean;
};

/**
 * Séries (ADR-008, ADR-042) : on parcourt les check-ins terminés dans l'ordre des
 * journées. Une journée sobre ajoute 1 ; une consommation remet la série actuelle à 0
 * (la meilleure série et le cumul restent intacts) ; une journée absente est ignorée.
 */
export function calculateStreaks(checkins: readonly ProgressCheckin[]): StreakMetrics {
  let current = 0;
  let best = 0;
  let lastDocumentedWasConsumption = false;

  for (const checkin of sortByDate(checkins)) {
    if (isSoberStatus(checkin.status)) {
      current += 1;
      best = Math.max(best, current);
      lastDocumentedWasConsumption = false;
    } else {
      current = 0;
      lastDocumentedWasConsumption = true;
    }
  }

  return { current, best, lastDocumentedWasConsumption };
}
