import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/page-container";
import { LoadError } from "@/components/shared/load-error";
import { routes } from "@/config/routes";
import {
  buildFunnel,
  compareWithPrevious,
  formatComparison,
  formatPercentage,
  getAdminRange,
  getBucket,
  getPreviousRange,
  parseAdminPeriod,
  percentage,
  type AdminPeriod,
} from "@/features/admin/analytics/definitions";
import { FeatureAdoption, Funnel } from "@/features/admin/components/admin-blocks";
import { AdminPageHeader, AdminPeriodSelector, AdminSection, KpiCard, SmallSampleNote } from "@/features/admin/components/admin-ui";
import { TrendChart } from "@/features/admin/components/trend-chart";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdminFeatureAdoption, getAdminFunnel, getAdminOverview, getAdminTimeseries } from "@/lib/services/admin";

export const metadata: Metadata = { title: "Analytics" };

async function loadAnalytics(period: AdminPeriod) {
  const range = getAdminRange(period);
  const previousRange = getPreviousRange(period);
  const [overview, previous, series, funnel, adoption] = await Promise.all([
    getAdminOverview(range),
    previousRange ? getAdminOverview(previousRange) : Promise.resolve(null),
    getAdminTimeseries(range, getBucket(period)),
    getAdminFunnel(range),
    getAdminFeatureAdoption(range),
  ]);
  return { overview, previous, series, funnel, adoption };
}

/** Analytics détaillées : croissance, activation, engagement, adoption (agrégats seulement). */
export default async function AdminAnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  await requireAdmin(routes.adminAnalytics);
  const period = parseAdminPeriod((await searchParams).period);

  let data: Awaited<ReturnType<typeof loadAnalytics>>;
  try {
    data = await loadAnalytics(period);
  } catch {
    return (
      <PageContainer size="wide">
        <AdminPageHeader title="Analytics" description="Croissance, activation, engagement et adoption." />
        <LoadError message="Les données d'administration sont indisponibles pour le moment." />
      </PageContainer>
    );
  }
  const { overview: o, previous, series, funnel, adoption } = data;
  const granularity = getBucket(period);
  const growth = formatComparison(compareWithPrevious(o.newUsers, previous?.newUsers ?? null));
  const perActive = o.activeUsers > 0 ? (o.checkins / o.activeUsers).toLocaleString("fr-CA", { maximumFractionDigits: 1 }) : "—";

  return (
    <PageContainer size="wide">
      <AdminPageHeader title="Analytics" description="Croissance, activation, engagement et adoption des fonctionnalités." updatedAt={new Date()} />
      <AdminPeriodSelector current={period} basePath={routes.adminAnalytics} />
      <SmallSampleNote population={o.totalUsers} />

      <AdminSection title="Croissance">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <KpiCard label="Total utilisateurs" value={o.totalUsers} hint="Cumul" />
          <KpiCard label="Nouveaux sur la période" value={o.newUsers} detail={growth} />
          <KpiCard label="Nouveaux (7 derniers jours)" value={o.newUsers7d} />
        </div>
        <TrendChart points={series.map((p) => ({ bucket: p.bucket, value: p.signups }))} granularity={granularity} unit="inscriptions" valueLabel="Inscriptions" />
      </AdminSection>

      <AdminSection title="Activation" description="Personnes inscrites sur la période.">
        <Funnel
          steps={buildFunnel({
            signups: funnel.signups,
            onboarded: funnel.onboarded,
            firstCheckin: funnel.firstCheckin,
            returned: funnel.returned,
            j7Eligible: funnel.j7Eligible,
            activeJ7: funnel.activeJ7,
          })}
        />
      </AdminSection>

      <AdminSection title="Engagement" description="Activité significative : check-in, moment d'envie, plan, bilan, rapport PDF, avis.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <KpiCard label="Actifs sur la période" value={o.activeUsers} />
          <KpiCard label="Actifs (7 jours)" value={o.activeUsers7d} />
          <KpiCard label="Actifs (30 jours)" value={o.activeUsers30d} />
          <KpiCard label="Check-ins par utilisateur actif" value={perActive} hint="Sur la période" />
          <KpiCard label="Au moins 3 check-ins" value={o.users3Checkins} detail={`${formatPercentage(percentage(o.users3Checkins, o.totalUsers))} des inscrits`} />
          <KpiCard label="Au moins 7 check-ins" value={o.users7Checkins} detail={`${formatPercentage(percentage(o.users7Checkins, o.totalUsers))} des inscrits`} />
        </div>
        <p className="text-sm text-muted-foreground">
          Actifs 7 jours ÷ actifs 30 jours : {formatPercentage(percentage(o.activeUsers7d, o.activeUsers30d))}
          {o.totalUsers < 20 ? " (indicatif seulement avec si peu de comptes)" : ""}.
        </p>
        <TrendChart points={series.map((p) => ({ bucket: p.bucket, value: p.checkins }))} granularity={granularity} unit="check-ins terminés" valueLabel="Check-ins terminés" />
      </AdminSection>

      <AdminSection title="Adoption des fonctionnalités" description="Personnes distinctes sur la période. Le calendrier, le journal et la progression ne sont pas mesurés (aucun suivi de pages).">
        <FeatureAdoption adoption={adoption} population={o.activeUsers} />
      </AdminSection>
    </PageContainer>
  );
}
