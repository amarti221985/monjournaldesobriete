"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { ScoreTrend } from "@/features/progress/analytics";
import { SectionCard } from "@/features/progress/components/analytics/section-card";
import { formatPointDifference, formatScore, pluralize } from "@/features/progress/format";
import { scoreMeta, trendLabels } from "@/features/progress/score-labels";
import type { ScorePoint, ScoreSeriesKey } from "@/features/progress/scores";
import { formatLocalDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

const KEYS: ScoreSeriesKey[] = ["mood", "energy", "stress", "craving"];

function shortDate(date: string) {
  return formatLocalDate(date, { day: "numeric", month: "short" });
}

/** Infobulle minimale : date + score, jamais de texte personnel. */
function ChartTooltip({
  active,
  payload,
  metric,
}: {
  active?: boolean;
  payload?: { payload: ScorePoint }[];
  metric: ScoreSeriesKey;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  const value = point[metric];
  return (
    <div className="grid gap-0.5 rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      <p className="font-medium">{shortDate(point.date)}</p>
      <p className={cn(value === null && "text-muted-foreground")}>
        {value !== null ? `${scoreMeta[metric].label} : ${value}/10` : "Aucun check-in"}
      </p>
    </div>
  );
}

type ScoreEvolutionCardProps = {
  points: ScorePoint[];
  trends: ScoreTrend[];
  /** Vrai si la période est comparable (7, 30, 90 jours) */
  comparable: boolean;
  /** Vrai si les deux périodes ont assez de check-ins pour comparer */
  comparisonSufficient: boolean;
  checkinCount: number;
};

/**
 * « Ton évolution » : UN graphique, une métrique à la fois (lisible sur mobile).
 * Une journée sans check-in est une absence de point, jamais 0 (connectNulls=false).
 */
export function ScoreEvolutionCard({ points, trends, comparable, comparisonSufficient, checkinCount }: ScoreEvolutionCardProps) {
  const [metric, setMetric] = useState<ScoreSeriesKey>("mood");
  const meta = scoreMeta[metric];
  const trend = trends.find((item) => item.key === metric);
  const dense = points.length > 90;
  const recorded = points.filter((point) => point[metric] !== null);

  return (
    <SectionCard title="Ton évolution" description="Tes scores au fil des journées, sur 10.">
      <div role="group" aria-label="Score affiché" className="grid grid-cols-4 rounded-lg border p-0.5">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={key === metric}
            onClick={() => setMetric(key)}
            className={cn(
              "min-h-10 rounded-md px-1 text-sm font-medium transition-colors motion-reduce:transition-none",
              "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              key === metric ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {scoreMeta[key].label}
          </button>
        ))}
      </div>

      {checkinCount > 0 ? (
        <div className="h-60 w-full" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                domain={[meta.min, 10]}
                ticks={meta.min === 0 ? [0, 5, 10] : [1, 5, 10]}
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<ChartTooltip metric={metric} />} cursor={{ stroke: "var(--border)" }} />
              <Line
                type="monotone"
                dataKey={metric}
                name={meta.label}
                stroke={meta.color}
                strokeWidth={2}
                connectNulls={false}
                dot={{ r: dense ? 2.5 : 4, strokeWidth: dense ? 0 : 2, stroke: "var(--card)", fill: meta.color }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      <div aria-live="polite" className="grid gap-1">
        {trend?.current != null ? (
          <>
            <p className="text-sm">
              {meta.averageLabel} : <span className="text-lg font-semibold">{formatScore(trend.current)}</span>{" "}
              <span className="text-muted-foreground">
                ({checkinCount} {pluralize(checkinCount, "journée enregistrée", "journées enregistrées")})
              </span>
            </p>
            {comparable ? (
              comparisonSufficient && trend.previous !== null && trend.difference !== null && trend.direction ? (
                <p className="text-sm text-muted-foreground">
                  Période précédente : {formatScore(trend.previous)} · {formatPointDifference(trend.difference)} ·{" "}
                  {trendLabels[trend.direction]}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Pas encore assez de données pour comparer ces périodes.</p>
              )
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Aucun check-in sur cette période.</p>
        )}
      </div>

      {recorded.length > 0 ? (
        <details className="text-sm">
          <summary className="min-h-8 cursor-pointer text-muted-foreground">Voir les valeurs</summary>
          <div className="mt-2 max-h-72 overflow-y-auto">
            <table className="w-full text-left">
              <caption className="sr-only">{meta.label} par journée enregistrée</caption>
              <thead className="text-muted-foreground">
                <tr>
                  <th scope="col" className="py-1 pr-3 font-medium">Journée</th>
                  <th scope="col" className="py-1 font-medium">{meta.label}</th>
                </tr>
              </thead>
              <tbody>
                {recorded.map((point) => (
                  <tr key={point.date} className="border-t">
                    <th scope="row" className="py-1 pr-3 font-normal">{shortDate(point.date)}</th>
                    <td className="py-1">{point[metric]}/10</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </SectionCard>
  );
}
