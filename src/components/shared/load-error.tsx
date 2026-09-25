"use client";

import { CloudAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Erreur de chargement (tableau de bord, calendrier, journal) : on affiche l'erreur,
 * jamais un faux état vide ni des statistiques à zéro.
 */
export function LoadError({ message, title }: { message: string; title?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Card role="alert">
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-sm">
          <CloudAlert className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="grid gap-0.5">
            {title ? <span className="font-medium">{title}</span> : null}
            <span className={title ? "text-muted-foreground" : undefined}>{message}</span>
          </span>
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => startTransition(() => router.refresh())}
        >
          {isPending ? "Chargement…" : "Réessayer"}
        </Button>
      </CardContent>
    </Card>
  );
}
