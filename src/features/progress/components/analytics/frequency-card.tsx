import type { ReactNode } from "react";

import { ANALYTICS_THRESHOLDS, type Frequency } from "@/features/progress/analytics";
import { EmptyNote, SectionCard } from "@/features/progress/components/analytics/section-card";
import { pluralize } from "@/features/progress/format";

function FrequencyRows({ items, labels, max }: { items: Frequency[]; labels: Record<string, string>; max: number }) {
  return (
    <ul className="grid gap-2.5 text-sm">
      {items.map((item) => (
        <li key={item.slug} className="grid gap-1">
          <span className="flex items-baseline justify-between gap-3">
            <span>{labels[item.slug] ?? "Autre"}</span>
            <span className="shrink-0 font-semibold tabular-nums">
              {item.days} <span className="font-normal text-muted-foreground">{pluralize(item.days, "journée", "journées")}</span>
            </span>
          </span>
          {/* Barre décorative : le nombre est écrit juste au-dessus. */}
          <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full bg-primary/70" style={{ width: `${(item.days / max) * 100}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

type FrequencyCardProps = {
  title: string;
  description: string;
  items: Frequency[];
  labels: Record<string, string>;
  emptyText: string;
  /** Texte discret sous la liste (ex. fréquence ≠ cause) */
  footnote?: string;
  /** Contenu additionnel (observations liées) */
  children?: ReactNode;
};

/**
 * Éléments les plus fréquents (en JOURNÉES) : 5 affichés, « Voir plus » seulement
 * s'il en reste. Aucun score ni pourcentage : des comptes.
 */
export function FrequencyCard({ title, description, items, labels, emptyText, footnote, children }: FrequencyCardProps) {
  const top = items.slice(0, ANALYTICS_THRESHOLDS.topItems);
  const rest = items.slice(ANALYTICS_THRESHOLDS.topItems);
  const max = items[0]?.days ?? 1;

  return (
    <SectionCard title={title} description={description}>
      {items.length === 0 ? (
        <EmptyNote>{emptyText}</EmptyNote>
      ) : (
        <>
          <FrequencyRows items={top} labels={labels} max={max} />
          {rest.length > 0 ? (
            <details className="text-sm">
              <summary className="min-h-8 cursor-pointer text-muted-foreground">Voir plus ({rest.length})</summary>
              <div className="mt-2">
                <FrequencyRows items={rest} labels={labels} max={max} />
              </div>
            </details>
          ) : null}
        </>
      )}
      {children}
      {footnote ? <p className="text-xs text-pretty text-muted-foreground">{footnote}</p> : null}
    </SectionCard>
  );
}
