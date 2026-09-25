"use client";

import { BookHeart, Search, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition, type FormEvent } from "react";

import { StatusMessage } from "@/components/shared/status-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { routes } from "@/config/routes";
import { loadJournalEntriesAction } from "@/features/journal/actions";
import { JournalEntryCard } from "@/features/journal/components/journal-entry-card";
import {
  journalFiltersToSearch,
  PERIOD_FILTERS,
  periodFilterLabels,
  STATUS_FILTERS,
  statusFilterLabels,
  type JournalFilters,
  type PeriodFilter,
  type StatusFilter,
} from "@/features/journal/logic";
import type { JournalEntryPreview, JournalPage } from "@/lib/services/journal";

type JournalBrowserProps = {
  initialFilters: JournalFilters;
  initialPage: JournalPage;
};

const selectClassName =
  "h-11 w-full rounded-lg border border-input bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

/**
 * Journal : filtres (dans l'URL), recherche (JAMAIS dans l'URL, ADR-050) et
 * « Afficher plus ». Toutes les requêtes sont exécutées côté serveur (Server Action
 * → search_journal) : le navigateur ne reçoit que la page affichée.
 */
export function JournalBrowser({ initialFilters, initialPage }: JournalBrowserProps) {
  const [filters, setFilters] = useState<JournalFilters>(initialFilters);
  const [queryInput, setQueryInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [entries, setEntries] = useState<JournalEntryPreview[]>(initialPage.entries);
  const [nextCursor, setNextCursor] = useState<string | null>(initialPage.nextCursor);
  const [failed, setFailed] = useState(false);
  const [isLoading, startLoading] = useTransition();
  const [isLoadingMore, startLoadingMore] = useTransition();
  const resultsRef = useRef<HTMLHeadingElement>(null);

  function load(nextFilters: JournalFilters, query: string) {
    startLoading(async () => {
      const result = await loadJournalEntriesAction({ ...nextFilters, query }).catch(() => null);
      if (!result || result.status === "error") {
        setFailed(true);
        return;
      }
      setFailed(false);
      setEntries(result.entries);
      setNextCursor(result.nextCursor);
    });
  }

  function updateFilters(patch: Partial<JournalFilters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    // Filtres reflétés dans l'URL (retour arrière, rafraîchissement) ; jamais la recherche.
    window.history.replaceState(null, "", `${routes.journal}${journalFiltersToSearch(next)}`);
    load(next, activeQuery);
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = queryInput.trim();
    setActiveQuery(query);
    load(filters, query);
    resultsRef.current?.focus();
  }

  function clearSearch() {
    setQueryInput("");
    setActiveQuery("");
    load(filters, "");
  }

  function loadMore() {
    if (!nextCursor) return;
    startLoadingMore(async () => {
      const result = await loadJournalEntriesAction({ ...filters, query: activeQuery, before: nextCursor }).catch(() => null);
      if (!result || result.status === "error") {
        setFailed(true);
        return;
      }
      setFailed(false);
      setEntries((current) => [...current, ...result.entries]);
      setNextCursor(result.nextCursor);
    });
  }

  const isFiltered = filters.status !== "all" || filters.period !== "all" || activeQuery !== "";

  return (
    <div className="grid gap-6">
      <section aria-label="Rechercher et filtrer" className="grid gap-3 rounded-2xl border bg-card p-4">
        <form role="search" onSubmit={handleSearch} className="grid gap-2">
          <Label htmlFor="journal-search">Rechercher dans mon journal</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="journal-search"
                type="search"
                value={queryInput}
                onChange={(event) => setQueryInput(event.target.value)}
                placeholder="Rechercher un mot, une réflexion, une victoire..."
                maxLength={100}
                autoComplete="off"
                enterKeyHint="search"
                className="pr-10"
              />
              {queryInput ? (
                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label="Effacer la recherche"
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>
            <Button type="submit" size="lg" disabled={isLoading} aria-label="Rechercher" className="px-4">
              <Search aria-hidden="true" />
              <span className="hidden sm:inline">Rechercher</span>
            </Button>
          </div>
        </form>

        <div className="grid gap-2 min-[480px]:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="journal-status">Statut</Label>
            <select
              id="journal-status"
              value={filters.status}
              onChange={(event) => updateFilters({ status: event.target.value as StatusFilter })}
              className={selectClassName}
            >
              {STATUS_FILTERS.map((status) => (
                <option key={status} value={status}>
                  {statusFilterLabels[status]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="journal-period">Période</Label>
            <select
              id="journal-period"
              value={filters.period}
              onChange={(event) => updateFilters({ period: event.target.value as PeriodFilter })}
              className={selectClassName}
            >
              {PERIOD_FILTERS.map((period) => (
                <option key={period} value={period}>
                  {periodFilterLabels[period]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section aria-labelledby="journal-results-title" aria-busy={isLoading} className="grid gap-4">
        <h2 id="journal-results-title" ref={resultsRef} tabIndex={-1} className="sr-only outline-none">
          Entrées du journal
        </h2>
        <p aria-live="polite" className="sr-only">
          {isLoading ? "Chargement…" : `${entries.length} ${entries.length > 1 ? "entrées affichées" : "entrée affichée"}`}
        </p>

        {failed ? (
          <p role="alert" className="rounded-xl border bg-card p-4 text-sm">
            Impossible de charger ton journal pour le moment.{" "}
            <button type="button" className="font-medium text-primary underline" onClick={() => load(filters, activeQuery)}>
              Réessayer
            </button>
          </p>
        ) : null}

        {!failed && entries.length === 0 && !isLoading ? (
          isFiltered ? (
            <StatusMessage icon={Search} title="Aucun résultat" description="Essaie un autre mot ou modifie tes filtres." className="py-10" headingLevel="h3" />
          ) : (
            <StatusMessage
              icon={BookHeart}
              title="Ton journal commence ici"
              description="Chaque check-in que tu complètes apparaîtra ici pour t'aider à voir ton parcours avec plus de recul."
              className="py-10" headingLevel="h3"
            >
              <Button asChild size="lg">
                <Link href={routes.checkin}>Faire mon check-in</Link>
              </Button>
            </StatusMessage>
          )
        ) : null}

        <ol className={isLoading ? "grid gap-4 opacity-60 transition-opacity" : "grid gap-4"}>
          {entries.map((entry) => (
            <li key={entry.date}>
              <JournalEntryCard entry={entry} headingLevel="h3" />
            </li>
          ))}
        </ol>

        {nextCursor ? (
          <Button type="button" variant="outline" size="lg" onClick={loadMore} disabled={isLoadingMore} className="justify-self-center">
            {isLoadingMore ? "Chargement…" : "Afficher plus"}
          </Button>
        ) : null}
      </section>
    </div>
  );
}
