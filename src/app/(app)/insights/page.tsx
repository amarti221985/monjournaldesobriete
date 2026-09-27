import { Clock, Sprout } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { LoadError } from "@/components/shared/load-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import {
  AiConsentPanel,
  AiPreferencesForm,
  DeleteReflectionButton,
  GenerateReflectionButton,
} from "@/features/insights/components/ai-controls";
import { ReflectionView } from "@/features/insights/components/reflection-view";
import { getConfiguredAiProvider } from "@/lib/ai/anthropic-provider";
import { AI_LIMITS } from "@/lib/ai/privacy";
import { getNextGenerationAt, getWeeklyPeriod } from "@/lib/ai/weekly";
import { requireUser } from "@/lib/auth/session";
import { formatDateTimeInZone, formatLocalDate, formatLongDate, getUserToday } from "@/lib/dates";
import { getAiPreferences, listAiReflections, type AiReflectionRecord } from "@/lib/services/ai";
import { getCurrentProfile } from "@/lib/services/profiles";
import { getProgressDataset } from "@/lib/services/progress";
import type { AiPreferences } from "@/lib/ai/privacy";

export const metadata: Metadata = {
  title: "Mes bilans",
};

const periodLabel = (start: string, end: string) =>
  `du ${formatLocalDate(start, { day: "numeric", month: "long" })} au ${formatLongDate(end)}`;

/**
 * « Mes bilans » (Sprint 12) : lecture seule au rendu. Aucune donnée n'est envoyée au
 * fournisseur sans consentement explicite ET clic sur « Générer mon bilan ».
 */
export default async function InsightsPage() {
  const user = await requireUser(routes.insights);
  const timezone = (await getCurrentProfile())?.timezone;
  const today = getUserToday(timezone);
  const period = getWeeklyPeriod(today);
  const provider = getConfiguredAiProvider();

  let preferences: AiPreferences;
  let reflections: AiReflectionRecord[];
  let checkinCount: number;
  try {
    const [loadedPreferences, loadedReflections, dataset] = await Promise.all([
      getAiPreferences(user.id),
      listAiReflections(user.id),
      getProgressDataset(user.id),
    ]);
    preferences = loadedPreferences;
    reflections = loadedReflections;
    checkinCount = dataset.checkins.filter((item) => item.date >= period.start && item.date <= period.end).length;
  } catch {
    return (
      <PageContainer>
        <PageHeader title="Mes bilans" />
        <LoadError message="Nous n'avons pas pu charger tes bilans pour le moment." />
      </PageContainer>
    );
  }

  const current = reflections.find((item) => item.periodStart === period.start && item.periodEnd === period.end) ?? null;
  const previous = reflections.filter((item) => item !== current);
  const nextGenerationAt = getNextGenerationAt(preferences.lastGenerationAt);

  return (
    <PageContainer>
      <PageHeader title="Mes bilans" description="Prends du recul sur ton parcours et découvre ce qui ressort de tes propres données." />

      {!provider ? (
        <Card size="sm">
          <CardContent className="text-sm text-pretty text-muted-foreground">
            Les bilans intelligents ne sont pas disponibles pour le moment. Aucune donnée n&apos;est envoyée, et le reste
            de ton journal fonctionne normalement.
          </CardContent>
        </Card>
      ) : null}

      {!preferences.aiEnabled ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 className="text-base font-semibold">Des bilans pour prendre du recul</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm text-pretty">
            <p>
              Un bilan résume ta semaine à partir de tes check-ins, de tes réflexions et de tes outils, puis te propose
              quelques questions. Les statistiques sont calculées par l&apos;application ; l&apos;IA aide seulement à les
              mettre en mots. C&apos;est désactivé par défaut.
            </p>
            {provider ? <AiConsentPanel preferences={preferences} providerLabel="Anthropic, modèle Claude" /> : null}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 className="text-base font-semibold">Cette semaine</h2>
            </CardTitle>
            <p className="text-sm text-muted-foreground">7 derniers jours, {periodLabel(period.start, period.end)}</p>
          </CardHeader>
          <CardContent className="grid gap-5">
            {current ? <ReflectionView reflection={current.content} /> : null}
            {checkinCount < AI_LIMITS.minCheckins ? (
              <div className="grid gap-3">
                <p className="text-sm text-pretty">
                  Il n&apos;y a pas encore assez de journées enregistrées pour créer un bilan utile ({checkinCount} sur{" "}
                  {AI_LIMITS.minCheckins} check-ins cette semaine).
                </p>
                <Button asChild variant="outline" className="justify-self-start">
                  <Link href={routes.checkin}>Faire mon check-in</Link>
                </Button>
              </div>
            ) : nextGenerationAt ? (
              <p className="flex items-start gap-2 text-sm text-pretty text-muted-foreground">
                <Clock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  Tu peux créer un bilan par période de 24 heures. Le prochain sera possible{" "}
                  {formatDateTimeInZone(nextGenerationAt, timezone)}.
                </span>
              </p>
            ) : provider ? (
              <GenerateReflectionButton regenerate={Boolean(current)} />
            ) : null}
            {!current && previous.length === 0 && checkinCount >= AI_LIMITS.minCheckins ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Sprout className="size-4 shrink-0" aria-hidden="true" />
                Ton premier bilan commencera ici.
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}

      {previous.length > 0 ? (
        <section aria-labelledby="previous-title" className="grid gap-3">
          <h2 id="previous-title" className="text-base font-semibold">
            Bilans précédents
          </h2>
          <ul className="grid gap-3">
            {previous.map((item) => (
              <li key={item.id}>
                <details className="rounded-xl border bg-card">
                  <summary className="flex min-h-12 cursor-pointer items-center px-4 font-medium">
                    {periodLabel(item.periodStart, item.periodEnd)}
                  </summary>
                  <div className="grid gap-4 px-4 pb-4">
                    <ReflectionView reflection={item.content} />
                    <DeleteReflectionButton id={item.id} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ) : current ? (
        <div>
          <DeleteReflectionButton id={current.id} />
        </div>
      ) : null}

      {!current && previous.length === 0 && preferences.aiEnabled ? (
        <p className="text-sm text-pretty text-muted-foreground">
          Lorsque tu auras quelques journées enregistrées, tu pourras prendre du recul sur ce qui ressort de ton parcours.
        </p>
      ) : null}

      {preferences.aiEnabled ? (
        <section aria-labelledby="ai-prefs-title" className="grid gap-3">
          <h2 id="ai-prefs-title" className="text-base font-semibold">
            Mes préférences IA
          </h2>
          <Card>
            <CardContent>
              <AiPreferencesForm preferences={preferences} hasReflections={reflections.length > 0} />
            </CardContent>
          </Card>
        </section>
      ) : null}
    </PageContainer>
  );
}
