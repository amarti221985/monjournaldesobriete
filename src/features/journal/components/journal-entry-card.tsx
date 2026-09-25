import Link from "next/link";

import { DayStatusBadge } from "@/components/shared/day-status-badge";
import { Button } from "@/components/ui/button";
import { journalDayHref } from "@/features/calendar/logic";
import { statusOptions } from "@/features/checkin/constants";
import type { JournalEntryPreview } from "@/lib/services/journal";
import { formatLocalDate } from "@/lib/dates";

const JOURNAL_STATUS_LABELS = {
  sober: "Sobre",
  challenging: "Sobre malgré une forte envie",
  consumed: "Consommation enregistrée",
} as const;

const PREVIEW_LENGTH = 220;

function preview(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > PREVIEW_LENGTH ? `${clean.slice(0, PREVIEW_LENGTH).trimEnd()}…` : clean;
}

/**
 * Carte du journal : titre (date), statut textuel, scores, victoire, émotions ou
 * déclencheurs, et un lien explicite. Même mise en forme pour toutes les journées.
 */
export function JournalEntryCard({ entry, headingLevel = "h2" }: { entry: JournalEntryPreview; headingLevel?: "h2" | "h3" }) {
  const Heading = headingLevel;
  const visualStatus = statusOptions[entry.status].visualStatus;
  const statusLabel = JOURNAL_STATUS_LABELS[visualStatus as keyof typeof JOURNAL_STATUS_LABELS];
  const scores = [
    ["Humeur", entry.moodScore],
    ["Stress", entry.stressScore],
    ["Envie", entry.cravingScore],
  ] as const;

  return (
    <article className="grid gap-3 rounded-2xl border bg-card p-4 sm:p-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <Heading className="font-semibold first-letter:uppercase">
          {formatLocalDate(entry.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </Heading>
        <DayStatusBadge status={visualStatus} label={statusLabel} />
      </header>

      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {scores.map(([label, value]) => (
          <div key={label} className="flex gap-1">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium">{value ?? "–"}</dd>
          </div>
        ))}
      </dl>

      {entry.victoryText ? (
        <div className="grid gap-0.5 text-sm">
          <p className="text-muted-foreground">Victoire</p>
          <p className="text-pretty">{preview(entry.victoryText)}</p>
        </div>
      ) : null}

      {entry.status === "consumed" && entry.triggers.length > 0 ? (
        <p className="text-sm">
          <span className="text-muted-foreground">Déclencheurs : </span>
          {entry.triggers.join(" · ")}
        </p>
      ) : entry.emotions.length > 0 ? (
        <p className="text-sm">
          <span className="text-muted-foreground">Émotions : </span>
          {entry.emotions.join(" · ")}
        </p>
      ) : null}

      <Button asChild variant="outline" className="justify-self-start">
        <Link href={journalDayHref(entry.date)}>
          Voir la journée
          <span className="sr-only">
            {" "}
            du {formatLocalDate(entry.date, { day: "numeric", month: "long", year: "numeric" })}
          </span>
        </Link>
      </Button>
    </article>
  );
}
