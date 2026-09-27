"use client";

import { FileText } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_REPORT_OPTIONS,
  REPORT_PERIODS,
  reportHref,
  reportPeriodLabels,
  type ReportOptions,
} from "@/features/reports/options";

type Toggle = { key: Exclude<keyof ReportOptions, "period">; label: string; hint: string };

const TOGGLES: Toggle[] = [
  { key: "includeReflections", label: "Inclure mes réflexions", hint: "Victoires, fiertés, leçons, intentions et notes." },
  { key: "includeConsumption", label: "Inclure les détails de consommation", hint: "Quantités, heures, contexte et réflexions." },
  { key: "includeCravings", label: "Inclure mes moments d'envie", hint: "Scores avant / après, stratégie, durée, contexte." },
  { key: "includePlan", label: "Inclure mon plan personnel", hint: "Raison, motivations, déclencheurs, stratégies, rappel." },
];

/**
 * Options du rapport PDF : période et sections. La lettre à soi-même et les coordonnées
 * des personnes de soutien ne sont jamais incluses. Seules ces options passent par l'URL.
 */
export function ReportOptionsForm({ aiAvailable }: { aiAvailable: boolean }) {
  const [options, setOptions] = useState<ReportOptions>(DEFAULT_REPORT_OPTIONS);
  const toggles = aiAvailable
    ? [...TOGGLES, { key: "includeAi" as const, label: "Inclure mes bilans intelligents", hint: "Résumés et questions de tes bilans." }]
    : TOGGLES;

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="reportPeriod">Période</Label>
        <select
          id="reportPeriod"
          value={options.period}
          onChange={(event) => setOptions((current) => ({ ...current, period: event.target.value as ReportOptions["period"] }))}
          className="h-11 w-full rounded-lg border bg-card px-3 text-sm sm:max-w-xs"
        >
          {REPORT_PERIODS.map((period) => (
            <option key={period} value={period}>
              {reportPeriodLabels[period]}
            </option>
          ))}
        </select>
      </div>
      <fieldset className="grid gap-3">
        <legend className="mb-2 text-sm font-medium">Sections</legend>
        {toggles.map((toggle) => (
          <label key={toggle.key} className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={options[toggle.key]}
              onChange={(event) => setOptions((current) => ({ ...current, [toggle.key]: event.target.checked }))}
              className="mt-0.5 size-4 accent-primary"
            />
            <span className="grid gap-0.5">
              <span className="font-medium">{toggle.label}</span>
              <span className="text-muted-foreground">{toggle.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <p className="text-xs text-pretty text-muted-foreground">
        Ce document peut contenir des informations personnelles. Conserve-le dans un endroit sécuritaire. La lettre à
        toi-même et les coordonnées de tes personnes de soutien ne sont jamais incluses.
      </p>
      <Button asChild className="justify-self-start">
        <a href={reportHref(options)} target="_blank" rel="noopener noreferrer">
          <FileText data-icon="inline-start" aria-hidden="true" />
          Créer mon rapport PDF
        </a>
      </Button>
    </div>
  );
}
