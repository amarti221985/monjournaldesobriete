import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { statusOptions } from "@/features/checkin/constants";
import { formatApproxDuration } from "@/features/craving/logic";
import { goalOptions, motivationOptions, type Motivation } from "@/features/onboarding/constants";
import { formatDecimal, formatPercent } from "@/features/progress/format";
import { calculateSobrietyMetrics, calculateStreaks } from "@/features/progress/metrics";
import { getPeriodStart } from "@/features/progress/periods";
import { average } from "@/features/progress/scores";
import { PrintButton } from "@/features/reports/components/print-button";
import { parseReportOptions, reportDocumentTitle, reportPeriodLabels } from "@/features/reports/options";
import type { WeeklyReflection } from "@/lib/ai/schemas";
import { requireUser } from "@/lib/auth/session";
import { formatLongDate, formatWeekdayDate, getUserToday } from "@/lib/dates";
import { getAiPreferences } from "@/lib/services/ai";
import { getTrackedSubstances } from "@/lib/services/journey";
import { getCurrentProfile } from "@/lib/services/profiles";
import { getProgressDataset } from "@/lib/services/progress";
import { collectReportData, type ReportCheckin } from "@/lib/services/report";

/** Titre = nom de fichier proposé à l'enregistrement en PDF : neutre, sans nom ni substance. */
export async function generateMetadata(): Promise<Metadata> {
  const profile = await getCurrentProfile();
  return {
    title: { absolute: reportDocumentTitle(getUserToday(profile?.timezone)) },
    robots: { index: false, follow: false, nocache: true },
  };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3 break-inside-avoid-page">
      <h2 className="border-b pb-1 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs font-medium text-muted-foreground print:text-neutral-600">{label}</dt>
      <dd className="text-sm text-pretty whitespace-pre-line">{value}</dd>
    </div>
  );
}

const score = (value: number | null) => (value === null ? "—" : `${value}/10`);
const avg = (values: (number | null)[]) => {
  const value = average(values);
  return value === null ? "—" : `${formatDecimal(value)}/10`;
};

function CheckinEntry({ checkin, reflections, consumption }: { checkin: ReportCheckin; reflections: boolean; consumption: boolean }) {
  const emotions = checkin.checkin_emotions.map((item) => item.emotions?.name_fr).filter(Boolean).join(", ");
  const triggers = checkin.checkin_triggers
    .map((item) => (item.custom_label ? `${item.trigger_types?.name_fr ?? "Autre"} (${item.custom_label})` : item.trigger_types?.name_fr))
    .filter(Boolean)
    .join(", ");
  return (
    <article className="grid gap-2 rounded-lg border p-3 break-inside-avoid">
      <h3 className="flex flex-wrap items-baseline justify-between gap-2 font-semibold">
        <span className="first-letter:uppercase">{formatWeekdayDate(checkin.checkin_date)}</span>
        <span className="text-sm font-normal">{statusOptions[checkin.status].label}</span>
      </h3>
      <p className="text-sm">
        Humeur {score(checkin.mood_score)} · Énergie {score(checkin.energy_score)} · Stress {score(checkin.stress_score)} · Envie{" "}
        {score(checkin.craving_score)}
      </p>
      <dl className="grid gap-2">
        <Field label="Émotions" value={emotions} />
        <Field label="Déclencheurs" value={triggers} />
        {reflections ? (
          <>
            <Field label="Victoire" value={checkin.victory_text} />
            <Field label="Ce dont je suis fier" value={checkin.proud_of_text} />
            <Field label="Ce que j'ai appris" value={checkin.lesson_text} />
            <Field label="Intention pour demain" value={checkin.tomorrow_intention_text} />
            <Field label="Notes" value={checkin.notes} />
          </>
        ) : null}
      </dl>
      {consumption && checkin.consumption_events.length > 0 ? (
        <div className="grid gap-2 border-t pt-2">
          <h4 className="text-sm font-medium">Consommation enregistrée</h4>
          {checkin.consumption_events.map((event, index) => (
            <dl key={index} className="grid gap-1 text-sm">
              <Field
                label="Substance"
                value={[
                  event.user_substances?.custom_name || event.user_substances?.substances?.name_fr,
                  event.quantity ? `${formatDecimal(event.quantity)}${event.unit ? ` ${event.unit}` : ""}` : null,
                  event.occurred_at ? `vers ${event.occurred_at.slice(0, 5).replace(":", " h ")}` : null,
                  event.craving_before !== null ? `envie avant : ${event.craving_before}/10` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
              <Field label="Contexte" value={event.context_text} />
              <Field label="Réflexion" value={event.reflection_text} />
              <Field label="La prochaine fois" value={event.next_time_strategy_text} />
            </dl>
          ))}
        </div>
      ) : null}
    </article>
  );
}

/**
 * Rapport « Mon parcours » (Sprint 12, ADR-088) : page imprimable protégée, enregistrée en
 * PDF par le navigateur (aucun service tiers). Données de l'utilisateur connecté seulement.
 * Jamais : lettre à soi-même, coordonnées des personnes de soutien.
 */
export default async function PersonalReportPage({ searchParams }: PageProps<"/reports/personal">) {
  const user = await requireUser(routes.settings);
  const options = parseReportOptions(await searchParams);
  const profile = await getCurrentProfile();
  const timeZone = profile?.timezone ?? siteConfig.defaultTimeZone;
  const today = getUserToday(profile?.timezone);

  const [dataset, substances, aiPreferences] = await Promise.all([
    getProgressDataset(user.id),
    getTrackedSubstances(user.id),
    getAiPreferences(user.id),
  ]);
  const journeyStart = substances.map((substance) => substance.startedOn).sort()[0] ?? null;
  const firstCheckin = dataset.checkins[0]?.date ?? today;
  const start = getPeriodStart(options.period, today) ?? [journeyStart, firstCheckin].filter(Boolean).sort()[0] ?? today;
  const range = { start: start > today ? today : start, end: today };
  const data = await collectReportData(user.id, range, options, aiPreferences.aiEnabled);

  const metrics = calculateSobrietyMetrics(data.checkins);
  const bestStreak = calculateStreaks(dataset.checkins).best;
  const generatedAt = new Intl.DateTimeFormat("fr-CA", { dateStyle: "long", timeStyle: "short", timeZone }).format(new Date());

  return (
    <main className="mx-auto grid w-full max-w-3xl gap-8 px-4 py-6 text-foreground sm:px-6 print:max-w-none print:gap-6 print:p-0 print:text-black">
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <Link href={routes.settings} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Paramètres
        </Link>
        <div className="grid gap-1 sm:justify-items-end">
          <PrintButton />
          <p className="text-xs text-muted-foreground">Choisis « Enregistrer en PDF » et le format Lettre ou A4.</p>
        </div>
      </div>

      <header className="grid gap-2 border-b pb-6 print:pb-4">
        <p className="text-sm font-medium text-muted-foreground print:text-neutral-600">{siteConfig.name}</p>
        <h1 className="text-3xl font-semibold tracking-tight">Mon parcours</h1>
        <p className="text-sm">
          Période : {reportPeriodLabels[options.period]} — du {formatLongDate(range.start)} au {formatLongDate(range.end)}
        </p>
        <p className="text-sm text-muted-foreground print:text-neutral-600">Généré le {generatedAt}</p>
        <p className="text-xs text-muted-foreground print:text-neutral-600">
          Ce document contient des informations personnelles. Conserve-le dans un endroit sécuritaire.
        </p>
      </header>

      <Section title="Résumé">
        <dl className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
          <Field label="Début du parcours" value={journeyStart ? formatLongDate(journeyStart) : "—"} />
          <Field
            label="Substances suivies"
            value={substances.map((substance) => `${substance.customName?.trim() || substance.name} — ${goalOptions[substance.goal].label}`).join("\n")}
          />
          <Field label="Jours suivis (check-ins complétés)" value={String(metrics.trackedDays)} />
          <Field label="Journées sobres enregistrées" value={String(metrics.soberDays)} />
          <Field label="Journées avec consommation" value={String(metrics.consumedDays)} />
          <Field label="Taux de sobriété (jours sobres ÷ jours suivis)" value={metrics.sobrietyRate === null ? "—" : formatPercent(metrics.sobrietyRate)} />
          <Field label="Meilleure série (tout le parcours)" value={String(bestStreak)} />
          <Field label="Interventions lors d'une envie" value={String(data.completedInterventions)} />
        </dl>
        <p className="text-xs text-muted-foreground print:text-neutral-600">
          Les statistiques sont calculées uniquement à partir des journées enregistrées ; une journée sans check-in
          n&apos;est comptée ni comme sobre ni comme journée avec consommation.
        </p>
      </Section>

      <Section title="Progression">
        {data.checkins.length === 0 ? (
          <p className="text-sm">Aucun check-in sur cette période.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Moyennes et répartition sur la période</caption>
            <tbody>
              {[
                ["Humeur moyenne", avg(data.checkins.map((item) => item.mood_score))],
                ["Énergie moyenne", avg(data.checkins.map((item) => item.energy_score))],
                ["Stress moyen", avg(data.checkins.map((item) => item.stress_score))],
                ["Envie moyenne", avg(data.checkins.map((item) => item.craving_score))],
                ["Journées sobres", String(metrics.soberDays - metrics.challengingDays)],
                ["Journées sobres malgré une forte envie", String(metrics.challengingDays)],
                ["Journées avec consommation", String(metrics.consumedDays)],
              ].map(([label, value]) => (
                <tr key={label} className="border-b">
                  <th scope="row" className="py-1.5 pr-4 font-normal">{label}</th>
                  <td className="py-1.5 font-medium">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Mon journal">
        {data.checkins.length === 0 ? (
          <p className="text-sm">Aucun check-in sur cette période.</p>
        ) : (
          <div className="grid gap-3">
            {data.checkins.map((checkin) => (
              <CheckinEntry
                key={checkin.checkin_date}
                checkin={checkin}
                reflections={options.includeReflections}
                consumption={options.includeConsumption}
              />
            ))}
          </div>
        )}
      </Section>

      {options.includeCravings ? (
        <Section title="Mes moments d'envie">
          {data.cravings.length === 0 ? (
            <p className="text-sm">Aucune intervention terminée sur cette période.</p>
          ) : (
            <div className="grid gap-2">
              {data.cravings.map((craving, index) => {
                const intervention = Array.isArray(craving.craving_interventions)
                  ? craving.craving_interventions[0]
                  : craving.craving_interventions;
                return (
                  <article key={index} className="grid gap-1 rounded-lg border p-3 text-sm break-inside-avoid">
                    <h3 className="font-semibold first-letter:uppercase">{formatWeekdayDate(craving.local_date)}</h3>
                    <p>
                      Envie : {craving.initial_craving_score}/10 → {craving.final_craving_score ?? "—"}/10
                      {intervention
                        ? ` · Stratégie : ${intervention.craving_strategies?.name_fr ?? intervention.custom_strategy_text ?? "—"}`
                        : ""}
                      {intervention?.actual_duration_seconds != null ? ` · Durée : environ ${formatApproxDuration(intervention.actual_duration_seconds)}` : ""}
                    </p>
                    {craving.context_text ? <p className="text-pretty whitespace-pre-line">Contexte : {craving.context_text}</p> : null}
                  </article>
                );
              })}
            </div>
          )}
        </Section>
      ) : null}

      {data.plan ? (
        <Section title="Mon plan personnel">
          <dl className="grid gap-3">
            <Field label="Pourquoi je fais ce changement" value={data.plan.reason} />
            <Field
              label="Ce qui compte pour moi"
              value={data.plan.motivations
                .map((item) => (item.motivation === "other" && item.custom_label ? item.custom_label : motivationOptions[item.motivation as Motivation]?.label))
                .filter(Boolean)
                .join(", ")}
            />
            <Field
              label="Mes déclencheurs"
              value={data.plan.triggers
                .map((item) => [item.trigger_types?.name_fr ?? item.custom_label, item.notes].filter(Boolean).join(" — "))
                .join("\n")}
            />
            <Field
              label="Ce qui peut m'aider"
              value={data.plan.strategies
                .map((item) => [item.craving_strategies?.name_fr ?? item.custom_name, item.notes].filter(Boolean).join(" — "))
                .join("\n")}
            />
            <Field label="Mon rappel" value={data.plan.reminder} />
          </dl>
        </Section>
      ) : null}

      {options.includeAi && data.aiReflections.length > 0 ? (
        <Section title="Mes bilans intelligents">
          {data.aiReflections.map((reflection) => {
            const content = reflection.content as WeeklyReflection;
            return (
              <article key={`${reflection.period_start}-${reflection.period_end}`} className="grid gap-2 rounded-lg border p-3 text-sm break-inside-avoid">
                <h3 className="font-semibold">
                  Du {formatLongDate(reflection.period_start)} au {formatLongDate(reflection.period_end)}
                </h3>
                <p className="text-pretty">{reflection.summary}</p>
                {content.reflection_questions?.length ? (
                  <ul className="list-disc pl-5">
                    {content.reflection_questions.map((question) => (
                      <li key={question}>{question}</li>
                    ))}
                  </ul>
                ) : null}
                <p className="text-xs text-muted-foreground print:text-neutral-600">Généré avec l&apos;aide de l&apos;IA à partir de tes données enregistrées.</p>
              </article>
            );
          })}
        </Section>
      ) : null}

      <footer className="border-t pt-4 text-xs text-muted-foreground print:text-neutral-600">{siteConfig.disclaimer}</footer>
    </main>
  );
}
