import { CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { StatusMessage } from "@/components/shared/status-message";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";

export const metadata: Metadata = {
  title: "Compte supprimé",
  robots: { index: false },
};

/** Page publique après la suppression définitive du compte (aucun détail personnel). */
export default function AccountDeletedPage() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <StatusMessage
        icon={CircleCheck}
        title="Ton compte a été supprimé"
        description="Ton compte et les données personnelles enregistrées dans l'application ont été supprimés définitivement."
      >
        <Button asChild size="lg" variant="outline">
          <Link href={routes.home}>Retour à l&apos;accueil</Link>
        </Button>
      </StatusMessage>
    </div>
  );
}
