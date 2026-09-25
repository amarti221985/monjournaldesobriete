import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

type SelectableChipProps = {
  name: string;
  value: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
};

/**
 * Puce sélectionnable (sélection multiple) basée sur une vraie case à cocher.
 * État sélectionné : bordure, fond ET coche (jamais la couleur seule).
 */
export function SelectableChip({ name, value, label, checked, onCheckedChange, className }: SelectableChipProps) {
  return (
    <label
      className={cn(
        "group inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border bg-card px-4 text-sm font-medium transition-colors",
        "hover:border-primary/50 has-[:checked]:border-primary has-[:checked]:bg-secondary has-[:checked]:text-secondary-foreground",
        "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
        className,
      )}
    >
      <input
        type="checkbox"
        name={name}
        value={value}
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
        className="sr-only"
      />
      <Check
        aria-hidden="true"
        strokeWidth={3}
        className="-ml-1 hidden size-3.5 group-has-[:checked]:block"
      />
      {label}
    </label>
  );
}
