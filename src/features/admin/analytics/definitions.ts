/*
 * Définitions des analytics admin (Admin V1, docs/ADMIN.md) — source unique côté application.
 * Les agrégats sont calculés par les RPC SQL (activité significative, rétention, entonnoir) ;
 * ce module fixe les périodes, les seuils transmis aux RPC et les règles d'affichage.
 * Fonctions pures, testées.
 */

export const ADMIN_PERIODS = ["7d", "30d", "90d", "year", "all"] as const;
export type AdminPeriod = (typeof ADMIN_PERIODS)[number];
export const DEFAULT_ADMIN_PERIOD: AdminPeriod = "30d";

export const adminPeriodLabels: Record<AdminPeriod, string> = {
  "7d": "7 jours",
  "30d": "30 jours",
  "90d": "90 jours",
  year: "Cette année",
  all: "Tout",
};

/** Seuils (transmis aux RPC) : nouveau ≤ 7 j, actif = activité ≤ 7 j, inactif = aucune activité depuis 14 j. */
export const NEW_USER_DAYS = 7;
export const ACTIVE_WINDOW_DAYS = 7;
export const INACTIVE_AFTER_DAYS = 14;
/** Jours de rétention (activité significative au jour n ou après, jours calendaires UTC). */
export const RETENTION_DAYS = [1, 3, 7, 14, 30] as const;
export type RetentionDay = (typeof RETENTION_DAYS)[number];
/** En dessous, les pourcentages sont signalés comme peu fiables. */
export const SMALL_SAMPLE_THRESHOLD = 20;
export const ADMIN_PAGE_SIZE = 25;

const DAY_MS = 86_400_000;

export function parseAdminPeriod(value: unknown): AdminPeriod {
  return ADMIN_PERIODS.find((period) => period === value) ?? DEFAULT_ADMIN_PERIOD;
}

export type AdminRange = { from: Date; to: Date };

/** Plage [from, to[ en UTC. « Tout » commence à l'époque Unix ; « Cette année » au 1er janvier UTC. */
export function getAdminRange(period: AdminPeriod, now: Date = new Date()): AdminRange {
  const to = now;
  switch (period) {
    case "7d":
      return { from: new Date(to.getTime() - 7 * DAY_MS), to };
    case "30d":
      return { from: new Date(to.getTime() - 30 * DAY_MS), to };
    case "90d":
      return { from: new Date(to.getTime() - 90 * DAY_MS), to };
    case "year":
      return { from: new Date(Date.UTC(to.getUTCFullYear(), 0, 1)), to };
    case "all":
      return { from: new Date(0), to };
  }
}

/** Période précédente de même durée (comparaison) ; aucune pour « Tout » et « Cette année ». */
export function getPreviousRange(period: AdminPeriod, now: Date = new Date()): AdminRange | null {
  if (period === "all" || period === "year") return null;
  const current = getAdminRange(period, now);
  const length = current.to.getTime() - current.from.getTime();
  return { from: new Date(current.from.getTime() - length), to: current.from };
}

/** Granularité des graphiques : jour jusqu'à 30 jours, semaine au-delà. */
export function getBucket(period: AdminPeriod): "day" | "week" {
  return period === "7d" || period === "30d" ? "day" : "week";
}

/** Pourcentage arrondi, ou null si le dénominateur est nul (jamais « 0 % » ni « ∞ »). */
export function percentage(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100);
}

export function formatPercentage(value: number | null): string {
  return value === null ? "—" : `${value} %`;
}

export type Comparison = { kind: "none" } | { kind: "new" } | { kind: "change"; percent: number };

/** Évolution vs période précédente : « Nouveau » si la précédente valait 0, rien sans période précédente. */
export function compareWithPrevious(current: number, previous: number | null): Comparison {
  if (previous === null) return { kind: "none" };
  if (previous === 0) return current > 0 ? { kind: "new" } : { kind: "none" };
  return { kind: "change", percent: Math.round(((current - previous) / previous) * 100) };
}

export function formatComparison(comparison: Comparison): string | null {
  if (comparison.kind === "none") return null;
  if (comparison.kind === "new") return "Nouveau";
  const sign = comparison.percent > 0 ? "+" : comparison.percent < 0 ? "−" : "±";
  return `${sign}${Math.abs(comparison.percent)} % vs période précédente`;
}

export function isSmallSample(population: number): boolean {
  return population < SMALL_SAMPLE_THRESHOLD;
}

/** Cellule de rétention : « — » si personne n'a encore eu le temps d'atteindre le jour (cohorte immature). */
export function retentionCell(retained: number, eligible: number): { label: string; detail: string | null } {
  if (eligible === 0) return { label: "—", detail: null };
  return { label: formatPercentage(percentage(retained, eligible)), detail: `${retained}/${eligible}` };
}

export type ActivationStatus = "activated" | "not_activated";
export type ActivityStatus = "active" | "slowing" | "inactive";

/** Activation : onboarding terminé ET au moins un check-in terminé. */
export function getActivationStatus(user: { onboarded: boolean; firstCheckinAt: string | null }): ActivationStatus {
  return user.onboarded && user.firstCheckinAt !== null ? "activated" : "not_activated";
}

/** Activité : actif (≤ 7 j), moins actif (8–14 j), inactif (> 14 j ou jamais). */
export function getActivityStatus(lastActivityAt: string | null, now: Date = new Date()): ActivityStatus {
  if (!lastActivityAt) return "inactive";
  const days = (now.getTime() - Date.parse(lastActivityAt)) / DAY_MS;
  if (days <= ACTIVE_WINDOW_DAYS) return "active";
  if (days <= INACTIVE_AFTER_DAYS) return "slowing";
  return "inactive";
}

export const activationLabels: Record<ActivationStatus, string> = { activated: "Activé", not_activated: "Non activé" };
export const activityLabels: Record<ActivityStatus, string> = { active: "Actif", slowing: "Moins actif", inactive: "Inactif" };

/** Libellé pseudonyme : jamais le nom, le courriel ni l'UUID. */
export function pseudonym(code: string): string {
  return `Utilisateur #${code}`;
}

export const USER_FILTERS = ["all", "new", "activated", "active", "inactive", "onboarding_incomplete"] as const;
export type UserFilter = (typeof USER_FILTERS)[number];
export const userFilterLabels: Record<UserFilter, string> = {
  all: "Tous",
  new: "Nouveaux",
  activated: "Activés",
  active: "Actifs",
  inactive: "Inactifs",
  onboarding_incomplete: "Onboarding incomplet",
};
export const USER_SORTS = ["recent", "oldest", "activity"] as const;
export type UserSort = (typeof USER_SORTS)[number];
export const userSortLabels: Record<UserSort, string> = {
  recent: "Inscription récente",
  oldest: "Inscription ancienne",
  activity: "Dernière activité",
};

export function parseUserFilter(value: unknown): UserFilter {
  return USER_FILTERS.find((filter) => filter === value) ?? "all";
}
export function parseUserSort(value: unknown): UserSort {
  return USER_SORTS.find((sort) => sort === value) ?? "recent";
}
export function parsePage(value: unknown): number {
  const page = typeof value === "string" ? Number.parseInt(value, 10) : NaN;
  return Number.isFinite(page) && page >= 1 && page <= 10_000 ? page : 1;
}

export const FEATURES = ["checkin", "craving", "plan", "achievements", "ai", "pdf", "feedback"] as const;
export type Feature = (typeof FEATURES)[number];
export const featureLabels: Record<Feature, string> = {
  checkin: "Check-in terminé",
  craving: "Moment d'envie terminé",
  plan: "Mon plan modifié",
  achievements: "Accomplissement obtenu",
  ai: "Bilan IA enregistré",
  pdf: "Rapport PDF lancé",
  feedback: "Avis bêta envoyé",
};

export const FEEDBACK_STATUSES = ["new", "reviewed", "resolved"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
export const feedbackStatusLabels: Record<FeedbackStatus, string> = { new: "Nouveau", reviewed: "Lu", resolved: "Traité" };

export type FunnelStep = { label: string; count: number; conversion: number | null; note?: string };

/** Entonnoir : conversion depuis l'étape précédente ; J7 rapporté aux personnes ayant eu le temps. */
export function buildFunnel(f: {
  signups: number;
  onboarded: number;
  firstCheckin: number;
  returned: number;
  j7Eligible: number;
  activeJ7: number;
}): FunnelStep[] {
  return [
    { label: "Inscription", count: f.signups, conversion: null },
    { label: "Onboarding complété", count: f.onboarded, conversion: percentage(f.onboarded, f.signups) },
    { label: "Premier check-in", count: f.firstCheckin, conversion: percentage(f.firstCheckin, f.onboarded) },
    { label: "Retour avec activité", count: f.returned, conversion: percentage(f.returned, f.firstCheckin) },
    {
      label: "Actif à J7",
      count: f.activeJ7,
      conversion: percentage(f.activeJ7, f.j7Eligible),
      note: `parmi ${f.j7Eligible} personne${f.j7Eligible > 1 ? "s" : ""} inscrite${f.j7Eligible > 1 ? "s" : ""} depuis au moins 7 jours`,
    },
  ];
}
