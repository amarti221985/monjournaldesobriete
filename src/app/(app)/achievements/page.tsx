import { Sprout } from "lucide-react";
import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { LoadError } from "@/components/shared/load-error";
import { StatusMessage } from "@/components/shared/status-message";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { AchievementCard } from "@/features/achievements/components/achievement-card";
import { ReconcileAchievements } from "@/features/achievements/components/reconcile-achievements";
import { categoryLabels } from "@/features/achievements/constants";
import { buildAchievementViews, groupByCategory, selectNextSteps, type AchievementView } from "@/features/achievements/logic";
import { requireUser } from "@/lib/auth/session";
import { getAchievementDefinitions, getAchievementProgress, getEarnedAchievements } from "@/lib/services/achievements";
import { getCurrentProfile } from "@/lib/services/profiles";

export const metadata: Metadata = {
  title: "Mes accomplissements",
};

const TITLE = "Mes accomplissements";
const SUBTITLE = "Chaque étape compte. Retrouve ici les jalons que tu as atteints au fil de ton parcours.";

/**
 * Accomplissements (lecture seule, ADR-089) : l'affichage n'attribue rien. Les jalons atteints
 * mais pas encore enregistrés sont signalés (statut « atteint ») et enregistrés sur un clic.
 */
export default async function AchievementsPage() {
  const user = await requireUser(routes.achievements);
  const profile = await getCurrentProfile();
  const timeZone = profile?.timezone ?? siteConfig.defaultTimeZone;

  let views: AchievementView[];
  try {
    const [definitions, stats, earned] = await Promise.all([
      getAchievementDefinitions(),
      getAchievementProgress(),
      getEarnedAchievements(user.id),
    ]);
    views = buildAchievementViews(definitions, stats, earned);
  } catch {
    return (
      <PageContainer size="wide">
        <PageHeader title={TITLE} />
        <LoadError message="Nous n'avons pas pu charger tes accomplissements pour le moment." />
      </PageContainer>
    );
  }

  const earnedCount = views.filter((view) => view.status === "earned").length;
  const reachedCount = views.filter((view) => view.status === "reached").length;
  const nextSteps = selectNextSteps(views);
  const groups = groupByCategory(views);

  return (
    <PageContainer size="wide">
      <PageHeader title={TITLE} description={SUBTITLE} />

      {earnedCount === 0 ? (
        <StatusMessage
          icon={Sprout}
          headingLevel="h2"
          className="py-8"
          title="Ton parcours commence ici"
          description="Tes accomplissements apparaîtront au fil de tes check-ins, réflexions et actions."
        />
      ) : (
        <p className="text-lg">
          <span className="font-semibold">{earnedCount}</span>{" "}
          {earnedCount > 1 ? "accomplissements obtenus" : "accomplissement obtenu"}
        </p>
      )}

      {reachedCount > 0 ? <ReconcileAchievements count={reachedCount} /> : null}

      <nav aria-label="Catégories">
        <ul className="flex flex-wrap gap-2">
          {groups.map((group) => (
            <li key={group.category}>
              <a
                href={`#${group.category}`}
                className="inline-flex min-h-10 items-center rounded-full border bg-card px-4 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {categoryLabels[group.category].label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {nextSteps.length > 0 ? (
        <section aria-labelledby="next-steps-title" className="grid gap-3">
          <h2 id="next-steps-title" className="text-lg font-semibold">
            Prochaines étapes
          </h2>
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {nextSteps.map((view) => (
              <AchievementCard key={view.definition.slug} view={view} timeZone={timeZone} />
            ))}
          </ul>
        </section>
      ) : null}

      {groups.map((group) => (
        <section key={group.category} id={group.category} aria-labelledby={`${group.category}-title`} className="grid scroll-mt-24 gap-3">
          <div className="grid gap-0.5">
            <h2 id={`${group.category}-title`} className="text-lg font-semibold">
              {categoryLabels[group.category].label}
            </h2>
            <p className="text-sm text-pretty text-muted-foreground">{categoryLabels[group.category].description}</p>
          </div>
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {group.views.map((view) => (
              <AchievementCard key={view.definition.slug} view={view} timeZone={timeZone} />
            ))}
          </ul>
        </section>
      ))}
    </PageContainer>
  );
}
