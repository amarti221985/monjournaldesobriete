import { availableEvidenceKeys, type WeeklyInsightDataset } from "@/lib/ai/dataset";
import { weeklyReflectionSchema, type WeeklyReflection } from "@/lib/ai/schemas";

/*
 * Garde-fous déterministes appliqués à TOUTE sortie du modèle avant persistance
 * (ADR-086, ADR-087). Ils réduisent — sans pouvoir l'éliminer — le risque de contenu
 * inapproprié ou non fondé : une sortie refusée n'est jamais enregistrée.
 */

/** Vocabulaire interdit : diagnostic, prédiction, causalité, jugement, injonction. */
const FORBIDDEN_PATTERNS: { reason: string; pattern: RegExp }[] = [
  { reason: "diagnostic", pattern: /diagnos|trouble (de|lié|d'usage|de l'usage)|dépression|dépressi[fv]|bipolai|anxiété clinique|psychos|addiction|addict|toxicoman|pathologi|syndrome|sevrage grave/i },
  { reason: "prediction", pattern: /rechut|tu vas (re)?consommer|risque (de|élevé|important)|\d+\s?%|probabilit/i },
  { reason: "causality", pattern: /\bcaus(e|ent|é|ée|és|ées|er)\b|à cause d|provoqu|déclench(e|ent) ta consommation|entraîn(e|ent) ta consommation/i },
  { reason: "judgment", pattern: /échec|échou|faiblesse|manque de volonté|honte|tu aurais dû|mauvais(e)? (choix|semaine)|décevant/i },
  { reason: "injunction", pattern: /\btu dois\b|\bil faut que tu\b|\btu devrais\b|\barrête de\b|\bcoupe\b.*\bcontact/i },
];

export type GuardrailResult = { ok: true; reflection: WeeklyReflection } | { ok: false; reason: string };

function allTexts(reflection: WeeklyReflection): string[] {
  return [
    reflection.summary,
    ...reflection.progress.map((item) => item.text),
    ...reflection.recurring_themes.map((item) => item.text),
    ...reflection.difficult_moments.map((item) => item.text),
    ...reflection.strengths.map((item) => item.text),
    ...reflection.reflection_questions,
  ];
}

/**
 * Valide une sortie : schéma strict (tailles, nombres d'éléments, clés connues), clés de
 * justification présentes dans les données fournies, vocabulaire interdit absent.
 */
export function validateWeeklyReflection(raw: unknown, dataset: WeeklyInsightDataset): GuardrailResult {
  const parsed = weeklyReflectionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: "schema" };
  const reflection = parsed.data;

  const available = availableEvidenceKeys(dataset);
  const observations = [...reflection.progress, ...reflection.recurring_themes, ...reflection.difficult_moments, ...reflection.strengths];
  if (observations.some((item) => item.evidence_keys.some((key) => !available.has(key)))) {
    return { ok: false, reason: "ungrounded_evidence" };
  }

  for (const text of allTexts(reflection)) {
    for (const { reason, pattern } of FORBIDDEN_PATTERNS) {
      if (pattern.test(text)) return { ok: false, reason };
    }
  }
  return { ok: true, reflection };
}
