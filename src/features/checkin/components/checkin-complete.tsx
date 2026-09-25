import { CircleCheck } from "lucide-react";
import Link from "next/link";
import type { RefObject } from "react";

import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { CheckinSummaryView } from "@/features/checkin/components/checkin-summary-view";
import type { CheckinDisplay } from "@/features/checkin/display";

type CheckinCompleteProps = {
  headingRef: RefObject<HTMLHeadingElement | null>;
  checkin: CheckinDisplay;
  mode: "create" | "edit";
};

/**
 * Confirmation sobre après l'enregistrement : ni célébration excessive pour une
 * journée sobre, ni message négatif pour une journée avec consommation.
 */
export function CheckinComplete({ headingRef, checkin, mode }: CheckinCompleteProps) {
  return (
    <section aria-labelledby="checkin-complete-title" className="grid gap-6">
      <header className="grid justify-items-start gap-3 sm:rounded-2xl sm:border sm:bg-card sm:p-8 sm:shadow-sm">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
          <CircleCheck className="size-5" aria-hidden="true" />
          {mode === "edit" ? "Modifications enregistrées" : "Check-in enregistré"}
        </span>
        <h1
          id="checkin-complete-title"
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-semibold tracking-tight outline-none sm:text-3xl"
        >
          Journée enregistrée
        </h1>
        <p className="text-pretty text-muted-foreground">
          Merci d&apos;avoir pris quelques minutes pour faire le point.
          {checkin.status === "consumed"
            ? " Chaque check-in aide à mieux comprendre ton parcours, et ton historique reste intact."
            : null}
        </p>
        <Button asChild size="lg" className="mt-2 w-full sm:w-auto">
          <Link href={routes.today}>Retour à aujourd&apos;hui</Link>
        </Button>
      </header>

      <div className="sm:rounded-2xl sm:border sm:bg-card sm:p-8">
        <CheckinSummaryView checkin={checkin} />
      </div>
    </section>
  );
}
