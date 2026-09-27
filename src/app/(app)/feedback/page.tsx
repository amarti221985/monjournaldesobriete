import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { FeedbackForm } from "@/features/feedback/components/feedback-form";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Donner mon avis",
};

/**
 * Avis des bêta-testeurs (Sprint 13) : formulaire minimal. Aucune capture d'écran, aucune
 * donnée du journal ajoutée automatiquement.
 */
export default async function FeedbackPage() {
  await requireUser(routes.feedback);

  return (
    <PageContainer>
      <PageHeader
        title="Donner mon avis"
        description="L'application est en bêta. Un bug, un moment où tu ne savais pas quoi faire, une idée ou ce que tu aimes : tout nous aide."
      />
      <Card>
        <CardContent>
          <FeedbackForm />
        </CardContent>
      </Card>
      <p className="text-sm text-pretty text-muted-foreground">
        Seul ce que tu écris ici est envoyé, avec la section choisie. Ton journal n&apos;est jamais joint automatiquement.
      </p>
    </PageContainer>
  );
}
