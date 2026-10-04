import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/layout/page-container";
import { LoadError } from "@/components/shared/load-error";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import {
  activationLabels,
  activityLabels,
  featureLabels,
  getActivationStatus,
  getActivityStatus,
  pseudonym,
} from "@/features/admin/analytics/definitions";
import { RevealAccountEmail } from "@/features/admin/components/admin-controls";
import { AdminPageHeader, AdminSection, formatAdminDate } from "@/features/admin/components/admin-ui";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdminUserDetail, type AdminUserDetail } from "@/lib/services/admin";

export const metadata: Metadata = { title: "Fiche utilisateur" };

/** Fiche de compte et d'usage : aucune donnée du journal, du plan, de la consommation ni de l'IA. */
export default async function AdminUserDetailPage({ params }: PageProps<"/admin/users/[code]">) {
  await requireAdmin(routes.adminUsers);
  const { code } = await params;
  if (!/^[0-9A-F]{8}$/.test(code)) notFound();

  let user: AdminUserDetail | null;
  try {
    user = await getAdminUserDetail(code);
  } catch {
    return (
      <PageContainer>
        <LoadError message="Les données d'administration sont indisponibles pour le moment." />
      </PageContainer>
    );
  }
  if (!user) notFound();

  return (
    <PageContainer>
      <Button asChild variant="ghost" className="-ml-3 self-start">
        <Link href={routes.adminUsers}>
          <ArrowLeft data-icon="inline-start" aria-hidden="true" />
          Utilisateurs
        </Link>
      </Button>
      <AdminPageHeader title={pseudonym(user.code)} description="Informations de compte et d'usage du produit. Aucun contenu personnel." />

      <AdminSection title="Compte et activité">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Inscription</dt><dd>{formatAdminDate(user.signedUpAt)}</dd></div>
          <div><dt className="text-muted-foreground">Onboarding</dt><dd>{user.onboarded ? "Complété" : "Incomplet"}</dd></div>
          <div><dt className="text-muted-foreground">Premier check-in</dt><dd>{formatAdminDate(user.firstCheckinAt)}</dd></div>
          <div><dt className="text-muted-foreground">Dernière activité significative</dt><dd>{formatAdminDate(user.lastActivityAt)}</dd></div>
          <div><dt className="text-muted-foreground">Check-ins terminés</dt><dd className="tabular-nums">{user.checkins}</dd></div>
          <div><dt className="text-muted-foreground">Avis envoyés</dt><dd className="tabular-nums">{user.feedbackCount}</dd></div>
          <div><dt className="text-muted-foreground">Activation</dt><dd>{activationLabels[getActivationStatus(user)]}</dd></div>
          <div><dt className="text-muted-foreground">Activité</dt><dd>{activityLabels[getActivityStatus(user.lastActivityAt)]}</dd></div>
        </dl>
      </AdminSection>

      <AdminSection title="Fonctionnalités utilisées" description="Depuis l'inscription (oui ou non, jamais le contenu).">
        {user.features.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune fonctionnalité utilisée pour l&apos;instant.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {user.features.map((feature) => (
              <li key={feature} className="rounded-full border px-3 py-1 text-sm">
                {featureLabels[feature]}
              </li>
            ))}
          </ul>
        )}
      </AdminSection>

      <AdminSection title="Support">
        <RevealAccountEmail code={user.code} />
      </AdminSection>
    </PageContainer>
  );
}
