"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = { bucket: string; value: number };

function bucketLabel(bucket: string, granularity: "day" | "week") {
  const date = new Date(`${bucket}T00:00:00Z`);
  const label = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "short", timeZone: "UTC" }).format(date);
  return granularity === "week" ? `sem. du ${label}` : label;
}

function ChartTooltip({
  active,
  payload,
  granularity,
  unit,
}: {
  active?: boolean;
  payload?: { payload: Point }[];
  granularity: "day" | "week";
  unit: string;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="grid gap-0.5 rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      <p className="font-medium">{bucketLabel(point.bucket, granularity)}</p>
      <p>
        {point.value} {unit}
      </p>
    </div>
  );
}

/**
 * Graphique en barres (agrégats seulement). Le graphique est décoratif pour les lecteurs
 * d'écran : les valeurs sont disponibles dans le tableau « Voir les valeurs ».
 */
export function TrendChart({
  points,
  granularity,
  unit,
  valueLabel,
}: {
  points: Point[];
  granularity: "day" | "week";
  unit: string;
  valueLabel: string;
}) {
  const total = points.reduce((sum, point) => sum + point.value, 0);
  return (
    <div className="grid gap-3">
      <div className="h-56 w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="bucket"
              tickFormatter={(bucket: string) => bucketLabel(bucket, granularity)}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip granularity={granularity} unit={unit} />} cursor={{ fill: "var(--muted)" }} />
            <Bar dataKey="value" name={valueLabel} fill="var(--primary)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-sm text-muted-foreground">
        Total sur la période : <span className="font-medium text-foreground tabular-nums">{total}</span> {unit}
      </p>
      <details className="text-sm">
        <summary className="min-h-8 cursor-pointer text-muted-foreground">Voir les valeurs</summary>
        <div className="mt-2 max-h-72 overflow-y-auto">
          <table className="w-full text-left">
            <caption className="sr-only">{valueLabel}</caption>
            <thead>
              <tr className="border-b text-muted-foreground">
                <th scope="col" className="py-1 font-medium">
                  {granularity === "week" ? "Semaine (UTC)" : "Jour (UTC)"}
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  {valueLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.bucket} className="border-b last:border-0">
                  <td className="py-1">{bucketLabel(point.bucket, granularity)}</td>
                  <td className="py-1 text-right tabular-nums">{point.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
