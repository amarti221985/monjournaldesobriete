import { availableEvidenceKeys, type WeeklyInsightDataset } from "@/lib/ai/dataset";
import { weeklyReflectionSchema, type WeeklyReflection } from "@/lib/ai/schemas";

/*
 * Garde-fous déterministes appliqués à TOUTE sortie du modèle avant persistance
 * (ADR-086, ADR-087). Ils réduisent — sans pouvoir l'éliminer — le risque de contenu
 * inapproprié ou non fondé. Une observation ou une question non conforme est RETIRÉE
 * (jamais corrigée) ; la sortie entière est refusée si le résumé est non conforme ou s'il
 * reste moins de 2 questions. Rien de refusé n'est enregistré.
 */

/** Vocabulaire interdit : diagnostic, prédiction, causalité, jugement, injonction. */
const FORBIDDEN_PATTERNS: { reason: string; pattern: RegExp }[] = [
  { reason: "diagnostic", pattern: /diagnos|trouble (de|lié|d'usage|de l'usage)|dépression|dépressi[fv]|bipolai|anxiété clinique|psychos|addiction|addict|toxicoman|pathologi|syndrome|sevrage grave/i },
  { reason: "prediction", pattern: /rechut|tu vas (re)?consommer|risque (de|élevé|important)|\d+\s?%|probabilit/i },
  { reason: "causality", pattern: /\bcaus(e|ent|é|ée|és|ées|er)\b|à cause d|provoqu|déclench(e|ent) ta consommation|entraîn(e|ent) ta consommation/i },
  { reason: "judgment", pattern: /échec|échou|faiblesse|manque de volonté|honte|tu aurais dû|mauvais(e)? (choix|semaine)|décevant/i },
  { reason: "injunction", pattern: /\btu dois\b|\bil faut que tu\b|\btu devrais\b|\barrête de\b|\bcoupe\b.*\bcontact/i },
];

const OBSERVATION_SECTIONS = ["progress", "recurring_themes", "difficult_moments", "strengths"] as const;
const MAX_ITEMS = 3;
const MAX_QUESTIONS = 3;

export type GuardrailResult = { ok: true; reflection: WeeklyReflection; removed: number } | { ok: false; reason: string };

export function forbiddenReason(text: string): string | null {
  return FORBIDDEN_PATTERNS.find(({ pattern }) => pattern.test(text))?.reason ?? null;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const textWithin = (value: unknown, min: number, max: number): value is string =>
  typeof value === "string" && value.trim().length >= min && value.trim().length <= max;

/**
 * Filtre une sortie brute : clés de justification limitées à celles réellement présentes,
 * observations sans justification, hors limites ou au vocabulaire interdit retirées,
 * listes tronquées. Ne réécrit jamais un texte.
 */
function filterOutput(raw: Record<string, unknown>, available: Set<string>): { output: Record<string, unknown>; removed: number } {
  let removed = 0;
  const output: Record<string, unknown> = { summary: raw.summary };

  for (const section of OBSERVATION_SECTIONS) {
    const items = Array.isArray(raw[section]) ? raw[section] : [];
    const kept = [];
    for (const item of items) {
      if (!isRecord(item) || !textWithin(item.text, 8, 320) || forbiddenReason(item.text)) {
        removed += 1;
        continue;
      }
      const keys = Array.isArray(item.evidence_keys) ? item.evidence_keys.filter((key): key is string => typeof key === "string" && available.has(key)) : [];
      if (keys.length === 0) {
        removed += 1; // observation non fondée sur les données envoyées
        continue;
      }
      kept.push({ text: item.text.trim(), evidence_keys: [...new Set(keys)].slice(0, 6) });
    }
    removed += Math.max(0, kept.length - MAX_ITEMS);
    output[section] = kept.slice(0, MAX_ITEMS);
  }

  const questions = Array.isArray(raw.reflection_questions) ? raw.reflection_questions : [];
  const keptQuestions = questions.filter((question): question is string => textWithin(question, 8, 240) && !forbiddenReason(question)).map((question) => question.trim());
  removed += questions.length - Math.min(keptQuestions.length, MAX_QUESTIONS);
  output.reflection_questions = keptQuestions.slice(0, MAX_QUESTIONS);
  return { output, removed };
}

/**
 * Valide une sortie : filtrage (ci-dessus), résumé conforme (taille, vocabulaire), schéma
 * strict final. `reason` est un code technique (journalisable), jamais du contenu.
 */
export function validateWeeklyReflection(raw: unknown, dataset: WeeklyInsightDataset): GuardrailResult {
  if (!isRecord(raw)) return { ok: false, reason: "schema" };
  if (typeof raw.summary === "string") {
    const reason = forbiddenReason(raw.summary);
    if (reason) return { ok: false, reason: `summary_${reason}` };
  }
  const { output, removed } = filterOutput(raw, availableEvidenceKeys(dataset));
  const parsed = weeklyReflectionSchema.safeParse(output);
  if (!parsed.success) {
    const path = parsed.error.issues[0]?.path.join(".") || "root";
    return { ok: false, reason: `schema_${path}` };
  }
  return { ok: true, reflection: parsed.data, removed };
}
