import { CalendarCheck, NotebookPen, Target } from "lucide-react";
import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { goalOptions } from "@/features/onboarding/constants";
import { requireUser } from "@/lib/auth/session";
import { formatLongDate } from "@/lib/dates";
import { getTrackedSubstances, type TrackedSubstance } from "@/lib/services/journey";
import { getCurrentProfile } from "@/lib/services/profiles";

export const metadata: Metadata = {
  title: "Aujourd'hui",
};

function substanceLabel(substance: TrackedSubstance) {
  return substance.customName ?? substance.name;
}

/**
 * Page temporaire : confirme l'accès et affiche le parcours réel (données de la base).
 * Le check-in quotidien arrive au Sprint 3, le tableau de bord au Sprint 4.
 */
export default async function TodayPage() {
  const user = await requireUser(routes.today);
  const [profile, substances] = await Promise.all([
    getCurrentProfile(),
    getTrackedSubstances(user.id),
  ]);
  const greeting = profile?.display_name ? `Bienvenue, ${profile.display_name}` : "Bienvenue";
  const primary = substances.find((substance) => substance.isPrimary) ?? substances[0];
  const others = substances.filter((substance) => substance !== primary);

  return (
    <PageContainer size="narrow">
      <PageHeader title="Aujourd'hui" description={greeting} />

      <Card>
        <CardContent className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"
          >
            <NotebookPen className="size-5" />
          </span>
          <div className="grid gap-1">
            <p className="font-medium">Ton parcours est prêt.</p>
            <p className="text-sm text-muted-foreground">
              Ton premier check-in quotidien arrive à l&apos;étape suivante.
            </p>
          </div>
        </CardContent>
      </Card>

      {primary ? (
        <section aria-labelledby="journey-title" className="grid gap-3">
          <h2 id="journey-title" className="text-sm font-medium text-muted-foreground">
            Mon parcours
          </h2>
          <dl className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
            <div className="flex gap-3">
              <CalendarCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="grid gap-0.5">
                <dt className="text-sm text-muted-foreground">Parcours commencé le</dt>
                <dd className="font-medium">{formatLongDate(primary.startedOn)}</dd>
              </div>
            </div>
            <div className="flex gap-3">
              <Target className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="grid gap-0.5">
                <dt className="text-sm text-muted-foreground">Objectif principal</dt>
                <dd className="font-medium">
                  {substanceLabel(primary)} — {goalOptions[primary.goal].label}
                </dd>
              </div>
            </div>
            {others.length > 0 ? (
              <div className="grid gap-0.5 sm:col-span-2">
                <dt className="text-sm text-muted-foreground">Aussi suivi</dt>
                <dd>
                  {others
                    .map((substance) => `${substanceLabel(substance)} — ${goalOptions[substance.goal].label}`)
                    .join(" · ")}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}

      <section aria-labelledby="account-title" className="grid gap-3">
        <h2 id="account-title" className="text-sm font-medium text-muted-foreground">
          Compte connecté
        </h2>
        <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0 truncate text-sm">{user.email ?? "Adresse non disponible"}</p>
          <SignOutButton />
        </div>
      </section>
    </PageContainer>
  );
}
