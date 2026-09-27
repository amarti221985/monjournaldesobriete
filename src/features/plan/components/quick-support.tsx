import { Compass, MapPin, MessageSquareQuote, Phone, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";

import { routes } from "@/config/routes";
import { toTelHref, type QuickSupport } from "@/features/plan/logic";

/**
 * « Ce qui peut m'aider maintenant » : ce que l'utilisateur a marqué dans son plan
 * (stratégie favorite, personne principale, lieu favori, rappel). Rien n'est déduit.
 */
export function QuickSupportCard({ support }: { support: QuickSupport }) {
  return (
    <section aria-labelledby="quick-support-title" className="grid gap-3 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="quick-support-title" className="text-base font-semibold">
          Ce qui peut m&apos;aider maintenant
        </h2>
        <Link href={routes.plan} className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:underline">
          <Compass className="size-3.5" aria-hidden="true" />
          Mon plan
        </Link>
      </div>
      <ul className="grid gap-2.5 text-sm">
        {support.reminder ? (
          <li className="flex gap-2.5">
            <MessageSquareQuote className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="text-pretty whitespace-pre-line">{support.reminder}</span>
          </li>
        ) : null}
        {support.strategy ? (
          <li className="flex gap-2.5">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              <span className="text-muted-foreground">Ma stratégie favorite : </span>
              {support.strategy.name}
            </span>
          </li>
        ) : null}
        {support.contact ? (
          <li className="flex flex-wrap items-center gap-2.5">
            <UserRound className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              <span className="text-muted-foreground">Ma personne de soutien : </span>
              {support.contact.name}
            </span>
            {support.contact.phone ? (
              <a
                href={toTelHref(support.contact.phone)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 font-medium hover:bg-muted"
              >
                <Phone className="size-3.5" aria-hidden="true" />
                Appeler
              </a>
            ) : null}
          </li>
        ) : null}
        {support.place ? (
          <li className="flex gap-2.5">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              <span className="text-muted-foreground">Mon lieu sûr : </span>
              {support.place.name}
            </span>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
