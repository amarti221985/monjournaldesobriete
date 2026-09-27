import { routes } from "@/config/routes";

/*
 * Rapport PDF (Sprint 12, ADR-088) : options choisies avant la génération. Seuls des
 * interrupteurs et une période (aucune donnée personnelle) transitent par l'URL.
 * La lettre à soi-même et les coordonnées des personnes de soutien ne sont JAMAIS
 * incluses (aucune option ne les active).
 */

export const REPORT_PERIODS = ["30d", "90d", "year", "all"] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export const reportPeriodLabels: Record<ReportPeriod, string> = {
  "30d": "30 derniers jours",
  "90d": "90 derniers jours",
  year: "Cette année",
  all: "Tout mon parcours",
};

export type ReportOptions = {
  period: ReportPeriod;
  /** Victoire, fierté, leçon, intention et notes des check-ins */
  includeReflections: boolean;
  /** Détails des consommations (quantités, contexte, réflexions) */
  includeConsumption: boolean;
  /** Moments d'envie et interventions */
  includeCravings: boolean;
  /** Raison, motivations, déclencheurs, stratégies, rappel (jamais la lettre ni les contacts) */
  includePlan: boolean;
  /** Bilans intelligents persistés */
  includeAi: boolean;
};

/** Valeurs par défaut : les sections les plus sensibles sont désactivées. */
export const DEFAULT_REPORT_OPTIONS: ReportOptions = {
  period: "90d",
  includeReflections: true,
  includeConsumption: false,
  includeCravings: false,
  includePlan: false,
  includeAi: false,
};

const FLAGS = {
  includeReflections: "reflections",
  includeConsumption: "consumption",
  includeCravings: "cravings",
  includePlan: "plan",
  includeAi: "ai",
} as const;

type SearchParams = Record<string, string | string[] | undefined>;

/** Lit les options depuis l'URL ; toute valeur inconnue revient à la valeur par défaut. */
export function parseReportOptions(searchParams: SearchParams): ReportOptions {
  const flag = (key: keyof typeof FLAGS) => {
    const value = searchParams[FLAGS[key]];
    if (value === "1") return true;
    if (value === "0") return false;
    return DEFAULT_REPORT_OPTIONS[key];
  };
  return {
    period: REPORT_PERIODS.find((period) => period === searchParams.period) ?? DEFAULT_REPORT_OPTIONS.period,
    includeReflections: flag("includeReflections"),
    includeConsumption: flag("includeConsumption"),
    includeCravings: flag("includeCravings"),
    includePlan: flag("includePlan"),
    includeAi: flag("includeAi"),
  };
}

export function reportHref(options: ReportOptions): string {
  const params = new URLSearchParams({ period: options.period });
  for (const [key, name] of Object.entries(FLAGS) as [keyof typeof FLAGS, string][]) {
    params.set(name, options[key] ? "1" : "0");
  }
  return `${routes.personalReport}?${params.toString()}`;
}

/** Titre du document = nom de fichier proposé à l'enregistrement : neutre. */
export function reportDocumentTitle(localDate: string): string {
  return `mon-parcours-${localDate}`;
}
