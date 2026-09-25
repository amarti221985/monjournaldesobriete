import { getFieldErrorId } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ScoreScaleProps = {
  id: string;
  label: string;
  min: number;
  max: number;
  minLabel: string;
  maxLabel: string;
  value?: number;
  onChange: (value: number | undefined) => void;
  error?: string;
  /** Facultatif : affiche « Effacer » lorsqu'une valeur est choisie. */
  optional?: boolean;
};

/**
 * Échelle 0-10 / 1-10 : groupe de boutons radio natifs (flèches du clavier, lecteurs
 * d'écran), grandes cibles tactiles, valeur choisie affichée en clair.
 * Plus fiable qu'un curseur sur mobile.
 */
export function ScoreScale({
  id,
  label,
  min,
  max,
  minLabel,
  maxLabel,
  value,
  onChange,
  error,
  optional = false,
}: ScoreScaleProps) {
  const values = Array.from({ length: max - min + 1 }, (_, index) => min + index);
  const hintId = `${id}-hint`;

  return (
    <fieldset
      id={id}
      tabIndex={-1}
      aria-describedby={[hintId, error ? getFieldErrorId(id) : null].filter(Boolean).join(" ")}
      className="grid gap-2.5 outline-none"
    >
      <legend className="mb-2.5 flex w-full items-baseline justify-between gap-3">
        <span className="font-medium">{label}</span>
        <span className="text-sm text-muted-foreground">
          {value !== undefined ? (
            <>
              <span className="text-base font-semibold text-foreground">{value}</span> / {max}
            </>
          ) : (
            "Non choisi"
          )}
        </span>
      </legend>

      <div className={cn("grid gap-1.5", max - min === 10 ? "grid-cols-6 sm:grid-cols-11" : "grid-cols-5 sm:grid-cols-10")}>
        {values.map((option) => (
          <label key={option} className="group cursor-pointer">
            <input
              type="radio"
              name={id}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              aria-label={
                option === min ? `${option} — ${minLabel}` : option === max ? `${option} — ${maxLabel}` : String(option)
              }
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className={cn(
                "flex h-11 items-center justify-center rounded-lg border bg-card text-sm font-medium transition-colors",
                "group-hover:border-primary/50 peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground",
                "peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
              )}
            >
              {option}
            </span>
          </label>
        ))}
      </div>

      <p id={hintId} className="flex justify-between gap-3 text-xs text-muted-foreground">
        <span>
          {min} · {minLabel}
        </span>
        <span className="text-right">
          {max} · {maxLabel}
        </span>
      </p>

      {optional && value !== undefined ? (
        <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={() => onChange(undefined)}>
          Effacer
        </Button>
      ) : null}

      {error ? (
        <p id={getFieldErrorId(id)} className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
