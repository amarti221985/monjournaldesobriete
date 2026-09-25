import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type SelectableOptionProps = {
  type: "checkbox" | "radio";
  name: string;
  value: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
  icon?: ReactNode;
  size?: "default" | "compact";
  className?: string;
};

/**
 * Grande carte sélectionnable basée sur un vrai input (checkbox ou radio) :
 * clavier, focus et état « coché » natifs pour les technologies d'assistance.
 * L'état sélectionné est visible par la bordure, le fond ET une coche.
 */
export function SelectableOption({
  type,
  name,
  value,
  checked,
  onCheckedChange,
  label,
  description,
  icon,
  size = "default",
  className,
}: SelectableOptionProps) {
  return (
    <label
      className={cn(
        "group relative flex cursor-pointer items-center gap-3 rounded-xl border bg-card text-left transition-colors",
        "hover:border-primary/50 has-[:checked]:border-primary has-[:checked]:bg-secondary",
        "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
        size === "compact" ? "min-h-12 px-3.5 py-2.5" : "min-h-14 px-4 py-3.5",
        className,
      )}
    >
      <input
        type={type}
        name={name}
        value={value}
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
        className="sr-only"
      />
      {icon ? (
        <span aria-hidden="true" className="shrink-0 text-muted-foreground group-has-[:checked]:text-secondary-foreground">
          {icon}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-medium text-foreground">{label}</span>
        {description ? <span className="text-sm text-muted-foreground">{description}</span> : null}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "flex size-5 shrink-0 items-center justify-center border border-input bg-background text-primary-foreground transition-colors",
          "group-has-[:checked]:border-primary group-has-[:checked]:bg-primary",
          type === "radio" ? "rounded-full" : "rounded-md",
        )}
      >
        <Check className="size-3.5 opacity-0 group-has-[:checked]:opacity-100" strokeWidth={3} />
      </span>
    </label>
  );
}
