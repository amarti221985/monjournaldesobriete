import { z } from "zod";

import { CHECKIN_STATUSES, type CheckinStatus } from "@/features/checkin/constants";
import { getPeriodStart, PERIOD_FILTERS, type PeriodFilter } from "@/features/progress/periods";
import { isValidDateString } from "@/lib/dates";

/*
 * Journal (ADR-049) : filtres, périodes, recherche et pagination. Logique pure.
 * Filtres dans l'URL (?status=&period=) ; le texte recherché ne l'est JAMAIS (ADR-050).
 */

export const JOURNAL_PAGE_SIZE = 20;
export const SEARCH_MAX_LENGTH = 100;

export const STATUS_FILTERS = ["all", ...CHECKIN_STATUSES] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

// Périodes partagées avec la page Progression (journées calendaires locales, ADR-052).
export { getPeriodStart, PERIOD_FILTERS, type PeriodFilter };

export const statusFilterLabels: Record<StatusFilter, string> = {
  all: "Tous",
  sober: "Sobre",
  sober_with_craving: "Sobre malgré une forte envie",
  consumed: "Consommation",
};

export const periodFilterLabels: Record<PeriodFilter, string> = {
  "7d": "7 derniers jours",
  "30d": "30 derniers jours",
  "90d": "90 derniers jours",
  year: "Cette année",
  all: "Tout",
};

export type JournalFilters = { status: StatusFilter; period: PeriodFilter };

export const DEFAULT_JOURNAL_FILTERS: JournalFilters = { status: "all", period: "all" };

/** Filtres lus depuis l'URL ; toute valeur inconnue revient à la valeur par défaut. */
export function parseJournalFilters(searchParams: Record<string, string | string[] | undefined>): JournalFilters {
  const status = STATUS_FILTERS.find((value) => value === searchParams.status) ?? "all";
  const period = PERIOD_FILTERS.find((value) => value === searchParams.period) ?? "all";
  return { status, period };
}

/** Paramètres d'URL des filtres (jamais le texte recherché). */
export function journalFiltersToSearch(filters: JournalFilters): string {
  const params = new URLSearchParams();
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.period !== "all") params.set("period", filters.period);
  const search = params.toString();
  return search ? `?${search}` : "";
}

/** Terme de recherche nettoyé (espaces, longueur) ; vide → null. */
export function normalizeSearchQuery(query: unknown): string | null {
  if (typeof query !== "string") return null;
  const clean = query.replace(/\s+/g, " ").trim().slice(0, SEARCH_MAX_LENGTH);
  return clean === "" ? null : clean;
}

export const journalRequestSchema = z.object({
  status: z.enum(STATUS_FILTERS).default("all"),
  period: z.enum(PERIOD_FILTERS).default("all"),
  query: z.string().max(500).optional(),
  /** Curseur : journée de la dernière entrée déjà affichée (pagination par date). */
  before: z.string().refine(isValidDateString).optional(),
});

export type JournalRequest = z.input<typeof journalRequestSchema>;

export type SearchJournalParams = {
  p_status?: CheckinStatus;
  p_from?: string;
  p_before?: string;
  p_query?: string;
  p_limit: number;
};

/** Paramètres de la fonction SQL search_journal() (une entrée de plus pour savoir s'il reste une page). */
export function toSearchJournalParams(request: z.output<typeof journalRequestSchema>, today: string): SearchJournalParams {
  const from = getPeriodStart(request.period, today);
  const query = normalizeSearchQuery(request.query);
  return {
    ...(request.status !== "all" ? { p_status: request.status } : {}),
    ...(from ? { p_from: from } : {}),
    ...(request.before ? { p_before: request.before } : {}),
    ...(query ? { p_query: query } : {}),
    p_limit: JOURNAL_PAGE_SIZE + 1,
  };
}

/** Sépare la page affichée de l'indicateur « il reste des entrées ». */
export function paginate<T extends { date: string }>(rows: readonly T[]): { entries: T[]; nextCursor: string | null } {
  const entries = rows.slice(0, JOURNAL_PAGE_SIZE);
  return { entries, nextCursor: rows.length > JOURNAL_PAGE_SIZE ? (entries.at(-1)?.date ?? null) : null };
}

/** Paramètre de route [date] : format strict YYYY-MM-DD, date réelle, jamais future. */
export function parseJournalDateParam(value: string, today: string): string | null {
  if (!isValidDateString(value) || value > today || value < "1900-01-01") return null;
  return value;
}
