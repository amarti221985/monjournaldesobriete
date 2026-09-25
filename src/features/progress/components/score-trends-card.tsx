"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScorePeriod, ScorePeriodData } from "@/features/progress/dashboard";
import { formatScore } from "@/features/progress/format";
import type { ScorePoint } from "@/features/progress/scores";
import { formatLocalDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

type SeriesKey = "mood" | "stress" | "craving";

/**
 * Trois séries au plus (lisibilité mobile). Couleurs validées (contraste, daltonisme)
 * + encodage secondaire : trait plein / tirets / pointillés et légende textuelle.
 */
const SERIES: { key: SeriesKey; label: string; color: string; dash?: string }[] = [
  { key: "mood", label: "Humeur", color: "var(--series-mood)" },
  { key: "stress", label: "Stress", color: "var(--series-stress)", dash: "6 4" },
  { key: "craving", label: "Envie", color: "var(--series-craving)", dash: "2 3" },
];

const AVERAGE_LABELS: Record<SeriesKey, string> = {
  mood: "humeur moyenne",
  stress: "stress moyen",
  craving: "envie moyenne",
};

function shortDate(date: string) {
  return formatLocalDate(date, { day: "numeric", month: "short" });
}

function SeriesSwatch({ color, dash }: { color: string; dash?: string }) {
  return (
    <svg width="22" height="8" aria-hidden="true" className="shrink-0">
      <line x1="1" y1="4" x2="21" y2="4" stroke={color} strokeWidth="2.5" strokeDasharray={dash} strokeLinecap="round" />
    </svg>
  );
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: ScorePoint }[] }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  const hasData = SERIES.some((series) => point[series.key] !== null);

  return (
    <div className="grid gap-1 rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      <p className="font-medium">{shortDate(point.date)}</p>
      {hasData ? (
        SERIES.map((series) => (
          <p key={series.key} className="flex items-center gap-2">
            <SeriesSwatch color={series.color} dash={series.dash} />
            {series.label} {point[series.key] !== null ? `${point[series.key]}/10` : "—"}
          </p>
        ))
      ) : (
        <p className="text-muted-foreground">Aucun check-in</p>
      )}
    </div>
  );
}

function AveragesSummary({ data }: { data: ScorePeriodData }) {
  const { averages, days } = data;
  if (averages.checkinCount === 0) {
    return <p className="text-sm text-muted-foreground">Aucun check-in sur les {days} derniers jours.</p>;
  }
  const parts = SERIES.map((series) => {
    const value = averages[series.key];
    return value !== null ? `${AVERAGE_LABELS[series.key]} ${formatScore(value)}` : null;
  }).filter(Boolean);

  return (
    <p className="text-sm text-pretty">
      Sur tes check-ins des {days} derniers jours ({averages.checkinCount}{" "}
      {averages.checkinCount > 1 ? "journées enregistrées" : "journée enregistrée"}) : {parts.join(", ")}.
    </p>
  );
}

/** Évolution récente de l'humeur, du stress et de l'envie (7 ou 30 jours). */
export function ScoreTrendsCard({ periods }: { periods: ScorePeriodData[] }) {
  const [period, setPeriod] = useState<ScorePeriod>(7);
  const data = periods.find((item) => item.days === period) ?? periods[0];
  const hasData = data.averages.checkinCount > 0;

  return (
    <Card>
      <CardHeader className="gap-3 sm:grid-cols-[1fr_auto]">
        <div className="grid gap-1">
          <CardTitle>
            <h2 className="text-base font-semibold">Comment tu te sens</h2>
          </CardTitle>
          <CardDescription>Humeur, stress et envie de consommer, sur 10.</CardDescription>
        </div>
        <div role="group" aria-label="Période" className="flex rounded-lg border p-0.5 sm:self-start">
          {periods.map((item) => (
            <button
              key={item.days}
              type="button"
              aria-pressed={item.days === period}
              onClick={() => setPeriod(item.days)}
              className={cn(
                "min-h-9 flex-1 rounded-md px-3 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                item.days === period ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.days} jours
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="grid gap-4">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Légende">
          {SERIES.map((series) => (
            <li key={series.key} className="flex items-center gap-2">
              <SeriesSwatch color={series.color} dash={series.dash} />
              {series.label}
            </li>
          ))}
        </ul>

        {hasData ? (
          <div className="h-56 w-full" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.points} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDate}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  interval="preserveStartEnd"
                  minTickGap={16}
                />
                <YAxis
                  domain={[0, 10]}
                  ticks={[0, 5, 10]}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border)" }} />
                {SERIES.map((series) => (
                  <Line
                    key={series.key}
                    type="monotone"
                    dataKey={series.key}
                    name={series.label}
                    stroke={series.color}
                    strokeWidth={2}
                    strokeDasharray={series.dash}
                    // Journée sans check-in : absence de donnée, jamais 0 ni une ligne inventée.
                    connectNulls={false}
                    dot={{ r: 4, strokeWidth: 2, stroke: "var(--card)", fill: series.color }}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : null}

        <AveragesSummary data={data} />

        {hasData ? (
          <details className="text-sm">
            <summary className="min-h-8 cursor-pointer text-muted-foreground">Voir les valeurs</summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left">
                <caption className="sr-only">Scores par journée, {period} derniers jours</caption>
                <thead className="text-muted-foreground">
                  <tr>
                    <th scope="col" className="py-1 pr-3 font-medium">Journée</th>
                    {SERIES.map((series) => (
                      <th key={series.key} scope="col" className="py-1 pr-3 font-medium">{series.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.points
                    .filter((point) => SERIES.some((series) => point[series.key] !== null))
                    .map((point) => (
                      <tr key={point.date} className="border-t">
                        <th scope="row" className="py-1 pr-3 font-normal">{shortDate(point.date)}</th>
                        {SERIES.map((series) => (
                          <td key={series.key} className="py-1 pr-3">
                            {point[series.key] !== null ? `${point[series.key]}/10` : "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}
