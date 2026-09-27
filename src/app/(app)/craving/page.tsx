import { History } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { LoadError } from "@/components/shared/load-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import {
  CUSTOM_STRATEGY,
  RECENT_CRAVING_LIMIT,
} from "@/features/craving/constants";
import { CravingHistoryList } from "@/features/craving/components/craving-history-list";
import { DismissCravingButton } from "@/features/craving/components/craving-session";
import { CravingStartForm } from "@/features/craving/components/craving-start-form";
import { SafetyNote } from "@/features/craving/components/safety-note";
import { StrategyInsights } from "@/features/craving/components/strategy-insights";
import { calculateStrategyEffectiveness } from "@/features/craving/logic";
import { requireUser } from "@/lib/auth/session";
import { getUserToday } from "@/lib/dates";
import { getCheckinCatalogues } from "@/lib/services/checkins";
import {
  closeStaleCravingEvents,
  getActiveCravingEventId,
  getCompletedCravingEvents,
  getCompletedInterventions,
  getCravingStrategies,
} from "@/lib/services/craving";
import { buildQuickSupport, hasQuickSupport } from "@/features/plan/logic";
import { QuickSupportCard } from "@/features/plan/components/quick-support";
import { getSupportContacts, getTrackedSubstances } from "@/lib/services/journey";
import { getPlanStrategies, getReminder, getSafePlaces } from "@/lib/services/plan";
import { getCurrentProfile } from "@/lib/services/profiles";

export const metadata: Metadata = {
  title: "Prends un moment",
};

/**
 * Mode « J'ai envie de consommer » : démarrage d'un moment + interventions récentes.
 * Lectures en parallèle (relations embarquées, aucun N+1) ; écritures par RPC.
 */
export default async function CravingPage() {
  const user = await requireUser(routes.craving);
  const profile = await getCurrentProfile();
  const timeZone = profile?.timezone ?? siteConfig.defaultTimeZone;
  const today = getUserToday(profile?.timezone);

  // Un moment resté en cours d'une journée passée n'est jamais repris (ADR-062).
  await closeStaleCravingEvents();

  let data;
  try {
    const [substances, catalogues, strategies, recent, completed, activeId] =
      await Promise.all([
        getTrackedSubstances(user.id),
        getCheckinCatalogues(),
        getCravingStrategies(),
        getCompletedCravingEvents(user.id, RECENT_CRAVING_LIMIT),
        getCompletedInterventions(user.id),
        getActiveCravingEventId(user.id, today),
      ]);
    data = { substances, catalogues, strategies, recent, completed, activeId };
  } catch {
    return (
      <PageContainer>
        <PageHeader title="Prends un moment" />
        <LoadError message="Nous n'avons pas pu charger cette page pour le moment." />
        <SafetyNote />
      </PageContainer>
    );
  }
  const { substances, catalogues, strategies, recent, completed, activeId } = data;

  // « Ce qui peut m'aider maintenant » (Mon plan) : facultatif, ne bloque jamais la page.
  const [planStrategies, contacts, places, reminder] = await Promise.allSettled([
    getPlanStrategies(user.id),
    getSupportContacts(user.id),
    getSafePlaces(user.id),
    getReminder(user.id),
  ]);
  const quickSupport = buildQuickSupport({
    strategies: planStrategies.status === "fulfilled" ? planStrategies.value : [],
    contacts: contacts.status === "fulfilled" ? contacts.value : [],
    places: places.status === "fulfilled" ? places.value : [],
    reminder: reminder.status === "fulfilled" ? (reminder.value?.content ?? null) : null,
  });

  const strategyNames: Record<string, string> = {
    ...Object.fromEntries(
      strategies.map((strategy) => [strategy.slug, strategy.name]),
    ),
    [CUSTOM_STRATEGY]: "Tes stratégies personnelles",
  };

  return (
    <PageContainer>
      <PageHeader
        title="Prends un moment"
        description="Une envie peut changer avec le temps. Commence par noter ce que tu ressens maintenant."
      />

      {activeId ? (
        <Card>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-pretty">
              Tu as un moment en cours aujourd&apos;hui.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild size="lg">
                <Link href={`${routes.craving}/${activeId}`}>
                  Continuer mon intervention
                </Link>
              </Button>
              <DismissCravingButton eventId={activeId} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="rounded-2xl border bg-card p-4 sm:p-6">
        <CravingStartForm
          substances={substances.map((substance) => ({
            id: substance.id,
            name: substance.customName?.trim() || substance.name,
          }))}
          emotions={catalogues.emotions}
          triggers={catalogues.triggers}
        />
      </div>

      {hasQuickSupport(quickSupport) ? <QuickSupportCard support={quickSupport} /> : null}

      <SafetyNote />

      <section aria-labelledby="recent-title" className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="recent-title" className="text-base font-semibold">
            Mes interventions récentes
          </h2>
          {recent.length > 0 ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={routes.cravingHistory}>
                <History data-icon="inline-start" aria-hidden="true" />
                Voir toutes mes interventions
              </Link>
            </Button>
          ) : null}
        </div>
        {recent.length > 0 ? (
          <CravingHistoryList
            events={recent}
            today={today}
            timeZone={timeZone}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Tes interventions terminées apparaîtront ici.
          </p>
        )}
      </section>

      <StrategyInsights
        items={calculateStrategyEffectiveness(completed)}
        strategyNames={strategyNames}
      />
    </PageContainer>
  );
}
