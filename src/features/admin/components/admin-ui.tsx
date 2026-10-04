import { Info } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ADMIN_PERIODS,
  adminPeriodLabels,
  isSmallSample,
  SMALL_SAMPLE_THRESHOLD,
  type AdminPeriod,
} from "@/features/admin/analytics/definitions";
import { cn } from "@/lib/utils";

/** En-tête d'une page d'administration (titre, sous-titre, dernière mise à jour). */
export function AdminPageHeader({ title, description, updatedAt }: { title: string; description: string; updatedAt?: Date }) {
  return (
    <header className="grid gap-1.5">
      <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h1>
      <p className="text-pretty text-muted-foreground">{description}</p>
      {updatedAt ? (
        <p className="text-xs text-muted-foreground">
          Dernière mise à jour :{" "}
          {new Intl.DateTimeFormat("fr-CA", { dateStyle: "long", timeStyle: "short", timeZone: "America/Toronto" }).format(updatedAt)}
        </p>
      ) : null}
    </header>
  );
}

/** Sélecteur de période : liens (?period=), aucune donnée sensible dans l'URL. */
export function AdminPeriodSelector({ current, basePath }: { current: AdminPeriod; basePath: string }) {
  return (
    <nav aria-label="Période analysée">
      <ul className="flex flex-wrap gap-2">
        {ADMIN_PERIODS.map((period) => (
          <li key={period}>
            <Link
              href={`${basePath}?period=${period}`}
              scroll={false}
              aria-current={period === current ? "page" : undefined}
              className={cn(
                "inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-medium transition-colors motion-reduce:transition-none",
                "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                period === current
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {adminPeriodLabels[period]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function KpiCard({ label, value, detail, hint }: { label: string; value: string | number; detail?: string | null; hint?: string }) {
  return (
    <Card size="sm" className="gap-1">
      <CardContent className="grid gap-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
        {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

export function AdminSection({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div className="grid gap-1">
          <CardTitle>
            <h2 className="text-base font-semibold">{title}</h2>
          </CardTitle>
          {description ? <CardDescription className="text-pretty">{description}</CardDescription> : null}
        </div>
        {action}
      </CardHeader>
      <CardContent className="grid min-w-0 gap-4 [&>*]:min-w-0">{children}</CardContent>
    </Card>
  );
}

/** Avertissement discret pour les petites populations. */
export function SmallSampleNote({ population }: { population: number }) {
  if (!isSmallSample(population)) return null;
  return (
    <p className="flex items-start gap-2 text-xs text-pretty text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      Petit échantillon ({population} {population > 1 ? "comptes" : "compte"}, moins de {SMALL_SAMPLE_THRESHOLD}) — interpréter les pourcentages avec prudence.
    </p>
  );
}

export function AdminEmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed p-4 text-sm text-pretty text-muted-foreground">{children}</p>;
}

/** Format court d'un horodatage (date, fuseau de l'administration). */
export function formatAdminDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium", timeZone: "America/Toronto" }).format(new Date(iso));
}
