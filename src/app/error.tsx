"use client";

import { CloudAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { StatusMessage } from "@/components/shared/status-message";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";

type ErrorPageProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

export default function ErrorPage({ error, retry }: ErrorPageProps) {
  useEffect(() => {
    // En production, le message est générique ; le digest permet de retrouver l'erreur dans les logs serveur.
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center">
      <StatusMessage
        icon={CloudAlert}
        title="Un problème est survenu"
        description="Cette page n'a pas pu s'afficher correctement. Tes données enregistrées ne sont pas affectées."
      >
        <Button size="lg" onClick={() => retry()}>
          Réessayer
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href={routes.home}>Retour à l&apos;accueil</Link>
        </Button>
      </StatusMessage>
    </main>
  );
}
