import type { ProgressCheckin } from "@/features/progress/types";
import { addDays } from "@/lib/dates";

/*
 * Séries de scores pour le graphique et moyennes. Une journée sans check-in reste
 * une ABSENCE de donnée (null), jamais 0.
 */

export type ScorePoint = {
  date: string;
  mood: number | null;
  energy: number | null;
  stress: number | null;
  craving: number | null;
};

export type ScoreSeriesKey = "mood" | "energy" | "stress" | "craving";

/** Un point par jour calendaire sur `days` jours se terminant aujourd'hui. */
export function buildScoreSeries(today: string, checkins: readonly ProgressCheckin[], days: number): ScorePoint[] {
  const byDate = new Map(checkins.map((checkin) => [checkin.date, checkin]));
  return Array.from({ length: days }, (_, index) => {
    const date = addDays(today, index - days + 1);
    const checkin = byDate.get(date);
    return {
      date,
      mood: checkin?.mood ?? null,
      energy: checkin?.energy ?? null,
      stress: checkin?.stress ?? null,
      craving: checkin?.craving ?? null,
    };
  });
}

/** Moyenne des valeurs présentes (les absences sont ignorées), null si aucune. */
export function average(values: readonly (number | null | undefined)[]): number | null {
  const present = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (present.length === 0) return null;
  return present.reduce((sum, value) => sum + value, 0) / present.length;
}

export type ScoreAverages = Record<ScoreSeriesKey, number | null> & {
  /** Nombre de journées avec check-in sur la période */
  checkinCount: number;
};

export function calculateScoreAverages(points: readonly ScorePoint[]): ScoreAverages {
  return {
    mood: average(points.map((point) => point.mood)),
    energy: average(points.map((point) => point.energy)),
    stress: average(points.map((point) => point.stress)),
    craving: average(points.map((point) => point.craving)),
    checkinCount: points.filter((point) => point.mood !== null || point.stress !== null || point.craving !== null).length,
  };
}
