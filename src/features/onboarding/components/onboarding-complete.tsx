import { Sprout } from "lucide-react";
import Link from "next/link";
import type { RefObject } from "react";

import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";

type OnboardingCompleteProps = {
  headingRef: RefObject<HTMLHeadingElement | null>;
};

/** Étape de confirmation, après une finalisation réussie. */
export function OnboardingComplete({ headingRef }: OnboardingCompleteProps) {
  return (
    <section
      aria-labelledby="onboarding-complete-title"
      className="grid justify-items-center gap-5 py-6 text-center sm:rounded-2xl sm:border sm:bg-card sm:p-10 sm:shadow-sm"
    >
      <span
        aria-hidden="true"
        className="inline-flex size-14 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground"
      >
        <Sprout className="size-7" />
      </span>
      <h1
        id="onboarding-complete-title"
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl font-semibold tracking-tight outline-none sm:text-3xl"
      >
        Ton parcours est prêt
      </h1>
      <p className="max-w-md text-pretty text-muted-foreground">
        Merci d&apos;avoir pris ce temps. Un jour à la fois, ton journal t&apos;accompagnera.
      </p>
      <Button asChild size="lg" className="w-full sm:w-auto">
        <Link href={routes.today} replace>
          Accéder à mon espace
        </Link>
      </Button>
    </section>
  );
}
