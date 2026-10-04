import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/page-container";
import { LoadError } from "@/components/shared/load-error";
import { routes } from "@/config/routes";
import { RetentionOverview, RetentionTable } from "@/features/admin/components/admin-blocks";
import { AdminEmptyState, AdminPageHeader, AdminSection, SmallSampleNote } from "@/features/admin/components/admin-ui";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdminRetention, type RetentionCohort } from "@/lib/services/admin";

export const metadata: Metadata = { title: "Rétention" };

/** Rétention J1–J30 et cohortes hebdomadaires (définitions : docs/ADMIN.md). */
export default async function AdminRetentionPage() {
  await requireAdmin(routes.adminRetention);
  let cohorts: RetentionCohort[];
  try {
    cohorts = await getAdminRetention();
  } catch {
    return (
      <PageContainer size="wide">
        <AdminPageHeader title="Rétention" description="Les personnes reviennent-elles ?" />
        <LoadError message="Les données d'administration sont indisponibles pour le moment." />
      </PageContainer>
    );
  }
  const population = cohorts.reduce((sum, cohort) => sum + cohort.signups, 0);

  return (
    <PageContainer size="wide">
      <AdminPageHeader title="Rétention" description="Les personnes inscrites reviennent-elles avec une activité significative ?" updatedAt={new Date()} />
      <SmallSampleNote population={population} />

      <AdminSection title="Vue d'ensemble" description="Toutes cohortes confondues.">
        {population === 0 ? (
          <AdminEmptyState>Les données apparaîtront ici lorsque les premiers utilisateurs se seront inscrits.</AdminEmptyState>
        ) : (
          <RetentionOverview cohorts={cohorts} />
        )}
      </AdminSection>

      <AdminSection title="Cohortes" description="Personnes regroupées par semaine d'inscription (semaine commençant le lundi, UTC).">
        {cohorts.length === 0 ? <AdminEmptyState>Aucune cohorte pour l&apos;instant.</AdminEmptyState> : <RetentionTable cohorts={cohorts} />}
      </AdminSection>

      <AdminSection title="Définitions">
        <ul className="grid list-disc gap-1 pl-5 text-sm text-pretty text-muted-foreground">
          <li>
            <strong className="font-medium text-foreground">Jn</strong> : la personne a eu au moins une activité significative le jour n après son
            inscription <em>ou plus tard</em> (jours calendaires UTC, jour 0 = jour de l&apos;inscription).
          </li>
          <li>
            <strong className="font-medium text-foreground">Dénominateur</strong> : personnes de la cohorte inscrites depuis au moins n jours (elles ont eu
            le temps d&apos;atteindre ce jour). Affiché « 3/5 » sous le pourcentage.
          </li>
          <li>
            <strong className="font-medium text-foreground">« — »</strong> : personne n&apos;a encore eu le temps d&apos;atteindre ce jour (cohorte
            immature) ; ce n&apos;est jamais 0 %.
          </li>
          <li>Activité significative : check-in terminé ou modifié, moment d&apos;envie terminé, plan modifié, bilan IA, rapport PDF lancé, avis envoyé.</li>
          <li>Comptes admin et de test exclus ; comptes supprimés non conservés (les chiffres peuvent donc baisser).</li>
        </ul>
      </AdminSection>
    </PageContainer>
  );
}
