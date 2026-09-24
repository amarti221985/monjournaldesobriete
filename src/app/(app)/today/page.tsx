import { NotebookPen } from "lucide-react";
import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { requireUser } from "@/lib/auth/session";
import { getCurrentProfile } from "@/lib/services/profiles";

export const metadata: Metadata = {
  title: "Aujourd'hui",
};

/** Page temporaire : confirme l'accès authentifié. Le vrai tableau de bord arrive au Sprint 4. */
export default async function TodayPage() {
  const user = await requireUser(routes.today);
  const profile = await getCurrentProfile();
  const greeting = profile?.display_name ? `Bienvenue, ${profile.display_name}` : "Bienvenue";

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
            <p className="font-medium">Ton espace est prêt.</p>
            <p className="text-sm text-muted-foreground">
              Le check-in quotidien sera ajouté prochainement.
            </p>
          </div>
        </CardContent>
      </Card>

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
