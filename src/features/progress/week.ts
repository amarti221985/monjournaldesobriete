import type { DayVisualStatus } from "@/config/day-status";
import { statusOptions } from "@/features/checkin/constants";
import { isSoberStatus, type ProgressCheckin } from "@/features/progress/types";
import { addDays, getWeekStart } from "@/lib/dates";

/*
 * Semaine en cours (lundi → dimanche, ADR-044) et résumé des 7 derniers jours
 * calendaires. Toutes les dates sont des journées locales (fuseau du profil).
 */

export type WeekDayState = DayVisualStatus | "future";

export type WeekDay = {
  date: string;
  state: WeekDayState;
  isToday: boolean;
};

function indexByDate(checkins: readonly ProgressCheckin[]) {
  return new Map(checkins.map((checkin) => [checkin.date, checkin]));
}

/** Les 7 journées de la semaine de `today`, lundi en premier. */
export function buildCurrentWeek(today: string, checkins: readonly ProgressCheckin[]): WeekDay[] {
  const byDate = indexByDate(checkins);
  const monday = getWeekStart(today);

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(monday, index);
    const checkin = byDate.get(date);
    let state: WeekDayState;
    if (date > today) state = "future";
    else if (checkin) state = statusOptions[checkin.status].visualStatus;
    else state = "untracked";
    return { date, state, isToday: date === today };
  });
}

export type RecentDaysSummary = {
  /** Nombre de jours calendaires couverts (aujourd'hui inclus) */
  days: number;
  soberDays: number;
  challengingDays: number;
  consumedDays: number;
  /** Journées passées sans check-in terminé */
  untrackedDays: number;
  /** Vrai si aujourd'hui n'a pas encore de check-in terminé (non compté comme non documenté) */
  todayPending: boolean;
};

/**
 * Les 7 derniers jours = aujourd'hui + les 6 jours calendaires précédents.
 * Aujourd'hui sans check-in n'est pas « non documenté » : la journée n'est pas finie.
 */
export function calculateRecentDaysSummary(
  today: string,
  checkins: readonly ProgressCheckin[],
  days = 7,
): RecentDaysSummary {
  const byDate = indexByDate(checkins);
  const summary: RecentDaysSummary = {
    days,
    soberDays: 0,
    challengingDays: 0,
    consumedDays: 0,
    untrackedDays: 0,
    todayPending: false,
  };

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = addDays(today, -offset);
    const checkin = byDate.get(date);
    if (!checkin) {
      if (date === today) summary.todayPending = true;
      else summary.untrackedDays += 1;
      continue;
    }
    if (isSoberStatus(checkin.status)) summary.soberDays += 1;
    if (checkin.status === "sober_with_craving") summary.challengingDays += 1;
    if (checkin.status === "consumed") summary.consumedDays += 1;
  }

  return summary;
}
