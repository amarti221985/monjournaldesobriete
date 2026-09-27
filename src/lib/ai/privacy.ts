/*
 * Confidentialité des bilans intelligents (Sprint 12, ADR-082 à ADR-084).
 * Source unique des règles : version du consentement, catégories autorisées et données
 * exclues en permanence. Le jeu de données envoyé au fournisseur est construit à partir
 * de ces règles par `buildWeeklyInsightDataset` (fonction pure, testée).
 */

/** Version du texte de consentement : à incrémenter si la politique IA change (nouveau consentement requis). */
export const AI_CONSENT_VERSION = "1";

export type AiPreferences = {
  aiEnabled: boolean;
  /** Victoire, fierté, leçon, intention (jamais les notes libres) */
  includeReflections: boolean;
  /** Textes des consommations (contexte, réflexion, stratégie) — OFF par défaut */
  includeConsumptionContext: boolean;
  /** Textes des moments d'envie (contexte, « ce qui a aidé », note) — OFF par défaut */
  includeCravingContext: boolean;
  consentedAt: string | null;
  consentVersion: string | null;
  /** Dernière génération réservée (fenêtre de 24 h, appliquée par la base) */
  lastGenerationAt: string | null;
};

/** Jamais envoyées au fournisseur, même avec consentement (documenté dans docs/AI.md). */
export const NEVER_SENT = [
  "adresse courriel et nom d'affichage",
  "personnes de soutien (noms, téléphones, courriels)",
  "lettre à soi-même",
  "lieux sûrs",
  "rappel personnel",
  "notes libres des check-ins",
  "raison personnelle",
  "précisions « Autre » saisies librement (déclencheurs, stratégies)",
  "identifiants internes, jetons et secrets",
] as const;

/** Limites de coût et de taille (ADR-083). */
export const AI_LIMITS = {
  /** Check-ins terminés minimum dans la période pour générer un bilan utile */
  minCheckins: 3,
  /** Journées de la période (7 derniers jours calendaires, aujourd'hui inclus) */
  periodDays: 7,
  /** Réflexions retenues au maximum (une par journée) */
  maxReflections: 7,
  /** Longueur maximale d'un texte envoyé (coupé à une fin de phrase) */
  maxTextLength: 280,
  /** Éléments maximum par liste de fréquences */
  maxFrequencyItems: 5,
  /** Moments d'envie retenus au maximum */
  maxCravings: 10,
  /** Un bilan par période glissante de N heures (appliqué par la base) */
  generationCooldownHours: 24,
} as const;

/**
 * Raccourcit un texte à une fin de phrase (ou de mot) plutôt qu'au milieu d'un mot ;
 * normalise les espaces. Renvoie null pour un texte vide.
 */
export function truncateForAi(value: string | null | undefined, max: number = AI_LIMITS.maxTextLength): string | null {
  const text = value?.replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const sentenceEnd = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
  if (sentenceEnd > max * 0.5) return slice.slice(0, sentenceEnd + 1);
  const wordEnd = slice.lastIndexOf(" ");
  return `${slice.slice(0, wordEnd > 0 ? wordEnd : max)}…`;
}
