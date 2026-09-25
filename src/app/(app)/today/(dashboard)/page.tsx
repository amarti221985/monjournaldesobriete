import type { Metadata } from "next";

import { LoadError } from "@/components/shared/load-error";
import { routes } from "@/config/routes";
import { TodayCheckinCard } from "@/features/checkin/components/today-checkin-card";
import { GoalCard } from "@/features/progress/components/goal-card";
import { InsightsCard } from "@/features/progress/components/insights-card";
import { MotivationsCard } from "@/features/progress/components/motivations-card";
import { ProgressOverviewCard } from "@/features/progress/components/progress-overview-card";
import { ScoreTrendsCard } from "@/features/progress/components/score-trends-card";
import { WeekCard } from "@/features/progress/components/week-card";
import { buildDashboard, type DashboardData } from "@/features/progress/dashboard";
import { requireUser } from "@/lib/auth/session";
import { formatLocalDate, getUserToday } from "@/lib/dates";
import { getCheckinForDate } from "@/lib/services/checkins";
import { getPrimaryReason, getTrackedSubstances, getUserMotivations } from "@/lib/services/journey";
import { getCurrentProfile } from "@/lib/services/profiles";
import { getCompletedCheckinsForProgress } from "@/lib/services/progress";

export const metadata: Metadata = {
  title: "Aujourd'hui",
};

/** Charge et calcule la progression ; une erreur n'affiche jamais de fausses statistiques. */
async function loadDashboard(userId: string, today: string): Promise<DashboardData | null> {
  try {
    return buildDashboard(today, await getCompletedCheckinsForProgress(userId));
  } catch {
    return null;
  }
}

/**
 * Tableau de bord quotidien. Hiérarchie (ADR-041) : aujourd'hui → progression cumulative
 * → constance (semaine) → compréhension (tendances) ; la série n'est qu'une métrique.
 * Requêtes indépendantes lancées en parallèle ; tous les calculs sont faits par
 * buildDashboard() (fonctions pures), jamais dans le JSX.
 */
export default async function TodayPage() {
  const user = await requireUser(routes.today);
  const profile = await getCurrentProfile();
  const today = getUserToday(profile?.timezone);

  const [checkin, substances, motivations, reason, dashboard] = await Promise.all([
    getCheckinForDate(user.id, today),
    getTrackedSubstances(user.id),
    getUserMotivations(user.id),
    getPrimaryReason(user.id),
    loadDashboard(user.id, today),
  ]);

  const firstName = profile?.display_name;
  const todayLabel = formatLocalDate(today, { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {firstName ? `Bonjour, ${firstName}` : "Bonjour"}
        </h1>
        <p className="text-muted-foreground">Aujourd&apos;hui, {todayLabel}</p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="grid gap-6 lg:col-span-2">
          <section aria-label="Check-in d'aujourd'hui">
            <TodayCheckinCard checkin={checkin} today={today} />
          </section>

          {dashboard ? (
            <>
              <ProgressOverviewCard metrics={dashboard.metrics} streaks={dashboard.streaks} />
              <WeekCard week={dashboard.week} recentDays={dashboard.recentDays} />
              {dashboard.metrics.trackedDays > 0 ? <ScoreTrendsCard periods={dashboard.scores} /> : null}
            </>
          ) : (
            <LoadError message="Nous n'avons pas pu charger ta progression pour le moment." />
          )}
        </div>

        <aside className="grid gap-6" aria-label="Repères">
          {dashboard ? (
            <InsightsCard insights={dashboard.insights} checkinsBeforeInsights={dashboard.checkinsBeforeInsights} />
          ) : null}
          <MotivationsCard motivations={motivations} reason={reason} />
          <GoalCard substances={substances} />
        </aside>
      </div>
    </div>
  );
}
