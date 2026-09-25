import { describe, expect, it } from "vitest";

import {
  getPeriodStart,
  journalFiltersToSearch,
  journalRequestSchema,
  normalizeSearchQuery,
  paginate,
  parseJournalDateParam,
  parseJournalFilters,
  toSearchJournalParams,
  JOURNAL_PAGE_SIZE,
} from "@/features/journal/logic";

const today = "2026-09-24";

describe("filtres depuis l'URL", () => {
  it.each([
    [{}, { status: "all", period: "all" }],
    [{ status: "sober" }, { status: "sober", period: "all" }],
    [{ status: "sober_with_craving", period: "30d" }, { status: "sober_with_craving", period: "30d" }],
    [{ status: "consumed", period: "90d" }, { status: "consumed", period: "90d" }],
    [{ period: "7d" }, { status: "all", period: "7d" }],
    [{ period: "year" }, { status: "all", period: "year" }],
    [{ status: "pirate", period: "10y" }, { status: "all", period: "all" }],
    [{ status: ["sober", "consumed"] }, { status: "all", period: "all" }],
  ])("%j → %j", (params, expected) => {
    expect(parseJournalFilters(params)).toEqual(expected);
  });

  it("l'URL ne contient que les filtres, jamais le texte recherché", () => {
    expect(journalFiltersToSearch({ status: "consumed", period: "90d" })).toBe("?status=consumed&period=90d");
    expect(journalFiltersToSearch({ status: "all", period: "all" })).toBe("");
  });
});

describe("périodes (journées locales, aujourd'hui inclus)", () => {
  it.each([
    ["7d", "2026-09-18"],
    ["30d", "2026-08-26"],
    ["90d", "2026-06-27"],
    ["year", "2026-01-01"],
    ["all", null],
  ] as const)("%s → %s", (period, start) => {
    expect(getPeriodStart(period, today)).toBe(start);
  });
});

describe("recherche", () => {
  it("nettoie le terme et ignore une recherche vide", () => {
    expect(normalizeSearchQuery("  marche   après ")).toBe("marche après");
    expect(normalizeSearchQuery("   ")).toBeNull();
    expect(normalizeSearchQuery(undefined)).toBeNull();
    expect(normalizeSearchQuery("a".repeat(300))).toHaveLength(100);
  });

  it("combine recherche, statut et période dans un seul appel serveur", () => {
    const request = journalRequestSchema.parse({ status: "sober", period: "90d", query: " travail " });
    expect(toSearchJournalParams(request, today)).toEqual({
      p_status: "sober",
      p_from: "2026-06-27",
      p_query: "travail",
      p_limit: JOURNAL_PAGE_SIZE + 1,
    });
  });

  it("« Tous » et « Tout » : aucun filtre transmis", () => {
    expect(toSearchJournalParams(journalRequestSchema.parse({}), today)).toEqual({ p_limit: JOURNAL_PAGE_SIZE + 1 });
  });

  it("refuse un statut, une période ou un curseur invalides", () => {
    expect(journalRequestSchema.safeParse({ status: "relapse" }).success).toBe(false);
    expect(journalRequestSchema.safeParse({ period: "10y" }).success).toBe(false);
    expect(journalRequestSchema.safeParse({ before: "2026-13-01" }).success).toBe(false);
  });
});

describe("pagination (curseur par journée, ordre décroissant)", () => {
  const rows = (count: number) =>
    Array.from({ length: count }, (_, index) => ({ date: `2026-01-${String(31 - index).padStart(2, "0")}` }));

  it("21 lignes reçues → 20 affichées + curseur sur la dernière", () => {
    const { entries, nextCursor } = paginate(rows(21));
    expect(entries).toHaveLength(20);
    expect(nextCursor).toBe("2026-01-12");
  });

  it("20 lignes ou moins → pas de page suivante", () => {
    expect(paginate(rows(20)).nextCursor).toBeNull();
    expect(paginate([]).nextCursor).toBeNull();
  });

  it("le curseur est transmis comme borne exclusive", () => {
    const request = journalRequestSchema.parse({ before: "2026-01-12" });
    expect(toSearchJournalParams(request, today).p_before).toBe("2026-01-12");
  });
});

describe("paramètre de route [date]", () => {
  it.each(["2026-09-24", "2026-09-01", "2024-02-29"])("accepte %s", (value) => {
    expect(parseJournalDateParam(value, today)).toBe(value);
  });

  it.each(["2026-09-25", "2026-02-30", "2026-9-24", "24-09-2026", "2026-09-24T00:00", "abc", "../today", "1899-12-31"])(
    "refuse %s",
    (value) => {
      expect(parseJournalDateParam(value, today)).toBeNull();
    },
  );
});
