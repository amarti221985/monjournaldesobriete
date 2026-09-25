import { CircleCheck, NotebookPen } from "lucide-react";
import Link from "next/link";

import { DayStatusBadge } from "@/components/shared/day-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { dayVisualStatusConfig } from "@/config/day-status";
import { routes } from "@/config/routes";
import { scoreDefinitions, statusOptions } from "@/features/checkin/constants";
import { RestartCheckinButton } from "@/features/checkin/components/restart-checkin-button";
import type { CheckinRecord } from "@/lib/services/checkins";

/** État du check-in d'aujourd'hui : à faire, commencé (brouillon) ou complété. */
export function TodayCheckinCard({ checkin, today }: { checkin: CheckinRecord | null; today: string }) {
  if (checkin?.completedAt) {
    const visualStatus = statusOptions[checkin.status].visualStatus;
    return (
      <Card>
        <CardContent className="grid gap-5">
          <p className="flex items-center gap-2 font-medium text-primary">
            <CircleCheck className="size-5" aria-hidden="true" />
            Ton check-in est complété pour aujourd&apos;hui.
          </p>
          <DayStatusBadge
            status={visualStatus}
            label={dayVisualStatusConfig[visualStatus].label}
            className="justify-self-start"
          />
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {scoreDefinitions.map((definition) => (
              <div key={definition.key} className="grid gap-0.5 rounded-xl bg-muted/60 px-3 py-2.5">
                <dt className="text-xs text-muted-foreground">{definition.label}</dt>
                <dd className="font-semibold">
                  {checkin[definition.key] ?? "–"}
                  <span className="text-xs font-normal text-muted-foreground"> / {definition.max}</span>
                </dd>
              </div>
            ))}
          </dl>
          {checkin.victoryText ? (
            <p className="text-sm whitespace-pre-line">
              <span className="text-muted-foreground">Ma victoire du jour : </span>
              {checkin.victoryText}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild size="lg">
              <Link href={routes.checkinEntry}>Voir mon check-in</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={routes.checkin}>Modifier</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (checkin) {
    return (
      <Card>
        <CardContent className="grid gap-4">
          <div className="grid gap-1">
            <p className="font-medium">Ton check-in est commencé.</p>
            <p className="text-sm text-muted-foreground">Tes réponses sont enregistrées. Tu peux reprendre là où tu étais.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button asChild size="lg">
              <Link href={routes.checkin}>Continuer mon check-in</Link>
            </Button>
            <RestartCheckinButton checkinDate={today} />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="grid gap-4">
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"
          >
            <NotebookPen className="size-5" />
          </span>
          <p className="self-center text-pretty">Prends deux minutes pour faire le point sur ta journée.</p>
        </div>
        <Button asChild size="lg" className="w-full sm:w-auto sm:justify-self-start">
          <Link href={routes.checkin}>Faire mon check-in</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
