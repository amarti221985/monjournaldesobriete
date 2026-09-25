/** Affichage à la française, 1 décimale maximum : 6.4 → « 6,4 », 6 → « 6 ». */
export function formatDecimal(value: number): string {
  return new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 1 }).format(value);
}

/** Score moyen : « 6,4 / 10 ». */
export function formatScore(value: number, max = 10): string {
  return `${formatDecimal(value)} / ${max}`;
}

/** Pourcentage arrondi à 1 décimale : 87.5 → « 87,5 % » (espace insécable). */
export function formatPercent(value: number): string {
  return `${formatDecimal(value)} %`;
}

/** Accord simple au pluriel : pluralize(1, "journée", "journées"). */
export function pluralize(count: number, singular: string, plural: string): string {
  return count > 1 ? plural : singular;
}

/**
 * Écart entre deux scores sur 10, en POINTS (jamais en %) : −1.2 → « −1,2 point »,
 * 2 → « +2 points ». Signe moins typographique ; 0 → « 0 point ».
 */
export function formatPointDifference(difference: number): string {
  const rounded = Math.round(difference * 10) / 10;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  const magnitude = Math.abs(rounded);
  return `${sign}${formatDecimal(magnitude)} ${magnitude >= 2 ? "points" : "point"}`;
}
