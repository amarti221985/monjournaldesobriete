import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageContainer } from "@/components/layout/page-container";
import { LoadError } from "@/components/shared/load-error";
import { routes } from "@/config/routes";
import { feedbackCategoryLabels } from "@/features/feedback/schema";
import {
  buildFunnel,
  getAdminRange,
  getBucket,
  parseAdminPeriod,
  percentage,
  formatPercentage,
  pseudonym,
  type AdminPeriod,
} from "@/features/admin/analytics/definitions";
import { FeatureAdoption, Funnel } from "@/features/admin/components/admin-blocks";
import {
  AdminEmptyState,
  AdminPageHeader,
  AdminPeriodSelector,
  AdminSection,
  formatAdminDate,
  KpiCard,
  SmallSampleNote,
} from "@/features/admin/components/admin-ui";
import { TrendChart } from "@/features/admin/components/trend-chart";
import { requireAdmin } from "@/lib/auth/admin";
import {
  getAdminFeatureAdoption,
  getAdminFeedbackPage,
  getAdminFunnel,
  getAdminOverview,
  getAdminTimeseries,
} from "@/lib/services/admin";

export const metadata: Metadata = { title: { absolute: "Administration" } };

/** « 1 avis reçu », « 3 avis reçus » : nombre + libellé accordé. */
function Pulse({ count, one, many }: { count: number; one: string; many: string }) {
  return (
    <li>
      <span className="font-semibold tabular-nums">{count}</span> {count > 1 ? many : one}
    </li>
  );
}

const categoryLabel = (category: string) =>
  category in feedbackCategoryLabels ? feedbackCategoryLabels[category as keyof typeof feedbackCategoryLabels] : category;

async function loadOverview(period: AdminPeriod) {
  const range = getAdminRange(period);
  const [overview, series, funnel, adoption, feedback] = await Promise.all([
    getAdminOverview(range),
    getAdminTimeseries(range, getBucket(period)),
    getAdminFunnel(range),
    getAdminFeatureAdoption(range),
    getAdminFeedbackPage(null, null, 1, 5),
  ]);
  return { overview, series, funnel, adoption, feedback };
}

/**
 * Vue d'ensemble (Admin V1) : agrégats seulement, comptes admin et de test exclus.
 * « Utilisateurs inscrits » est un cumul ; les autres indicateurs suivent la période.
 */
export default async function AdminHomePage({ searchParams }: PageProps<"/admin">) {
  await requireAdmin(routes.admin);
  const period = parseAdminPeriod((await searchParams).period);
  const now = new Date();

  let data: Awaited<ReturnType<typeof loadOverview>>;
  try {
    data = await loadOverview(period);
  } catch {
    return (
      <PageContainer size="wide">
        <AdminPageHeader title="Administration" description="Vue d'ensemble de l'utilisation et de la croissance de l'application." />
        <LoadError message="Les données d'administration sont indisponibles pour le moment." />
      </PageContainer>
    );
  }
  const { overview: o, series, funnel, adoption, feedback } = data;
  const granularity = getBucket(period);

  return (
    <PageContainer size="wide">
      <AdminPageHeader title="Administration" description="Vue d'ensemble de l'utilisation et de la croissance de l'application." updatedAt={now} />
      <AdminPeriodSelector current={period} basePath={routes.admin} />

      {o.totalUsers === 0 ? (
        <AdminEmptyState>Les données apparaîtront ici lorsque les premiers utilisateurs auront commencé à utiliser l&apos;application.</AdminEmptyState>
      ) : null}

      <section aria-labelledby="kpi-title" className="grid gap-3">
        <h2 id="kpi-title" className="sr-only">
          Indicateurs clés
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard label="Utilisateurs inscrits" value={o.totalUsers} hint="Cumul, toutes périodes" />
          <KpiCard label="Nouveaux utilisateurs" value={o.newUsers} hint="Sur la période" />
          <KpiCard label="Utilisateurs actifs" value={o.activeUsers} hint="Activité significative sur la période" />
          <KpiCard label="Onboarding complété" value={o.onboardedTotal} detail={`${formatPercentage(percentage(o.onboardedTotal, o.totalUsers))} des inscrits`} />
          <KpiCard label="Premier check-in" value={o.firstCheckinTotal} detail={`${formatPercentage(percentage(o.firstCheckinTotal, o.totalUsers))} d'activation`} />
          <KpiCard label="Check-ins" value={o.checkins} hint="Terminés sur la période" />
        </div>
        <SmallSampleNote population={o.totalUsers} />
      </section>

      <AdminSection title="Beta Pulse" description="L'état de la bêta en un coup d'œil (7 derniers jours pour l'activité).">
        <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <Pulse count={o.totalUsers} one="utilisateur bêta" many="utilisateurs bêta" />
          <Pulse count={o.newUsers7d} one="nouveau cette semaine" many="nouveaux cette semaine" />
          <Pulse count={o.onboardedTotal} one="onboarding complété" many="onboardings complétés" />
          <Pulse count={o.firstCheckinTotal} one="premier check-in" many="premiers check-ins" />
          <Pulse count={o.activeUsers7d} one="actif cette semaine" many="actifs cette semaine" />
          <Pulse count={o.checkins7d} one="check-in (7 jours)" many="check-ins (7 jours)" />
          <Pulse count={o.feedbackTotal} one="avis reçu" many="avis reçus" />
          <Pulse count={o.aiReflectionsTotal} one="bilan IA enregistré" many="bilans IA enregistrés" />
          <Pulse count={o.pdfReportsTotal} one="rapport PDF lancé" many="rapports PDF lancés" />
        </ul>
      </AdminSection>

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminSection title="Nouvelles inscriptions" description={granularity === "day" ? "Par jour (UTC)." : "Par semaine (UTC)."}>
          <TrendChart points={series.map((p) => ({ bucket: p.bucket, value: p.signups }))} granularity={granularity} unit="inscriptions" valueLabel="Inscriptions" />
        </AdminSection>
        <AdminSection title="Utilisateurs actifs" description="Personnes distinctes ayant eu une activité significative.">
          <TrendChart points={series.map((p) => ({ bucket: p.bucket, value: p.activeUsers }))} granularity={granularity} unit="(somme des personnes actives par intervalle)" valueLabel="Personnes actives" />
        </AdminSection>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminSection title="Activation" description="Personnes inscrites sur la période, de l'inscription à l'activité au jour 7.">
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
          <SmallSampleNote population={funnel.signups} />
        </AdminSection>
        <AdminSection title="Utilisation des fonctionnalités" description="Personnes distinctes sur la période (aucun contenu, aucune page vue).">
          <FeatureAdoption adoption={adoption} population={o.activeUsers} />
          <p className="text-xs text-muted-foreground">Pourcentages rapportés aux utilisateurs actifs de la période.</p>
        </AdminSection>
      </div>

      <AdminSection
        title="Derniers avis"
        action={
          <Link href={routes.adminFeedback} className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-primary hover:underline">
            Tous les avis
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        }
      >
        {feedback.rows.length === 0 ? (
          <AdminEmptyState>Aucun avis reçu pour l&apos;instant.</AdminEmptyState>
        ) : (
          <ul className="grid gap-3">
            {feedback.rows.map((item) => (
              <li key={item.id} className="grid gap-1 rounded-lg border p-3 text-sm">
                <p className="text-xs text-muted-foreground">
                  {formatAdminDate(item.createdAt)} · {item.excluded ? "Compte admin ou de test" : pseudonym(item.code)} · {categoryLabel(item.category)}
                </p>
                <p className="line-clamp-3 text-pretty">{item.message}</p>
              </li>
            ))}
          </ul>
        )}
      </AdminSection>

      <Link href={routes.adminRetention} className="inline-flex min-h-10 items-center gap-1 self-start text-sm font-medium text-primary hover:underline">
        Voir la rétention par cohorte
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </PageContainer>
  );
}
