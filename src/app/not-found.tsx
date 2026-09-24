import { Compass } from "lucide-react";
import Link from "next/link";

import { StatusMessage } from "@/components/shared/status-message";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center">
      <StatusMessage
        icon={Compass}
        title="Page introuvable"
        description="Cette page n'existe pas ou n'est pas encore disponible."
      >
        <Button asChild size="lg">
          <Link href={routes.home}>Retour à l&apos;accueil</Link>
        </Button>
      </StatusMessage>
    </main>
  );
}
