import { Sparkles } from "lucide-react";

import type { WeeklyReflection } from "@/lib/ai/schemas";

const SECTIONS: { key: keyof Omit<WeeklyReflection, "summary" | "reflection_questions">; title: string }[] = [
  { key: "recurring_themes", title: "Ce qui ressort" },
  { key: "progress", title: "Ce que tu as continué à construire" },
  { key: "strengths", title: "Tes points d'appui" },
  { key: "difficult_moments", title: "Moments plus difficiles" },
];

/** Affichage d'un bilan (texte échappé par React ; aucune justification interne affichée). */
export function ReflectionView({ reflection }: { reflection: WeeklyReflection }) {
  return (
    <div className="grid gap-5">
      <section aria-labelledby="summary-title" className="grid gap-1.5">
        <h3 id="summary-title" className="text-sm font-semibold">
          Ta semaine en quelques mots
        </h3>
        <p className="text-pretty">{reflection.summary}</p>
      </section>
      {SECTIONS.map((section) =>
        reflection[section.key].length > 0 ? (
          <section key={section.key} className="grid gap-1.5">
            <h3 className="text-sm font-semibold">{section.title}</h3>
            <ul className="grid list-disc gap-1 pl-5 text-sm text-pretty">
              {reflection[section.key].map((item) => (
                <li key={item.text}>{item.text}</li>
              ))}
            </ul>
          </section>
        ) : null,
      )}
      <section className="grid gap-1.5 rounded-xl bg-secondary/60 p-4">
        <h3 className="text-sm font-semibold">Questions pour toi</h3>
        <ul className="grid gap-1.5 text-sm text-pretty">
          {reflection.reflection_questions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>
      </section>
      <div className="grid gap-1 text-xs text-pretty text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <Sparkles className="size-3.5 shrink-0" aria-hidden="true" />
          Généré avec l&apos;aide de l&apos;IA à partir de tes données enregistrées.
        </p>
        <p>Ce bilan est un outil de réflexion. Il peut contenir des erreurs et ne remplace pas un professionnel de la santé.</p>
      </div>
    </div>
  );
}
