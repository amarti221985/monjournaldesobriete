import { dayVisualStatusConfig, type DayVisualStatus } from "@/config/day-status";
import { cn } from "@/lib/utils";

type DayStatusBadgeProps = {
  status: DayVisualStatus;
  /** Libellé affiché (par défaut, celui de l'état). */
  label?: string;
  className?: string;
};

/** État d'une journée : icône + texte + couleur (jamais la couleur seule). */
export function DayStatusBadge({ status, label, className }: DayStatusBadgeProps) {
  const config = dayVisualStatusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium",
        config.className.soft,
        className,
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {label ?? config.label}
    </span>
  );
}
