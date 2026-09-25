import {
  Circle,
  CircleCheck,
  CircleDashed,
  CircleDot,
  Minus,
  PencilLine,
  Waves,
  type LucideIcon,
} from "lucide-react";

/**
 * États VISUELS d'une journée (calendrier, journal, badges).
 *
 * Ce ne sont pas les statuts stockés en base : le statut affiché d'une journée
 * sera dérivé des données du check-in (voir docs/DECISIONS.md, ADR-007).
 * Chaque état combine toujours libellé + icône + couleur, pour ne jamais
 * dépendre uniquement de la couleur (accessibilité).
 */
export const dayVisualStatuses = [
  "sober",
  "challenging",
  "consumed",
  "untracked",
] as const;

export type DayVisualStatus = (typeof dayVisualStatuses)[number];

export type DayVisualStatusDefinition = {
  label: string;
  description: string;
  icon: LucideIcon;
  /** Classes Tailwind basées sur les tokens status-* de globals.css. */
  className: {
    solid: string;
    soft: string;
    text: string;
  };
};

export const dayVisualStatusConfig: Record<DayVisualStatus, DayVisualStatusDefinition> = {
  sober: {
    label: "Journée sobre",
    description: "Aucune consommation enregistrée ce jour-là.",
    icon: CircleCheck,
    className: {
      solid: "bg-status-sober text-primary-foreground",
      soft: "bg-status-sober-soft text-status-sober-foreground",
      text: "text-status-sober-foreground",
    },
  },
  challenging: {
    label: "Sobre malgré une forte envie",
    description: "Journée sobre traversée avec une envie élevée.",
    icon: Waves,
    className: {
      solid: "bg-status-challenging text-foreground",
      soft: "bg-status-challenging-soft text-status-challenging-foreground",
      text: "text-status-challenging-foreground",
    },
  },
  consumed: {
    label: "Journée avec consommation",
    description: "Une consommation a été enregistrée ce jour-là.",
    icon: CircleDot,
    className: {
      solid: "bg-status-consumed text-primary-foreground",
      soft: "bg-status-consumed-soft text-status-consumed-foreground",
      text: "text-status-consumed-foreground",
    },
  },
  untracked: {
    label: "Aucun check-in",
    description: "Aucune information enregistrée pour cette journée.",
    icon: CircleDashed,
    className: {
      solid: "bg-status-untracked text-foreground",
      soft: "bg-status-untracked-soft text-status-untracked-foreground",
      text: "text-status-untracked-foreground",
    },
  },
};

/**
 * États supplémentaires du calendrier (Sprint 5). Ils ne sont PAS des états de
 * journée documentée : un brouillon ne compte pas comme journée suivie, une journée
 * future n'est jamais « non documentée », une journée avant le début du parcours
 * n'est pas une journée manquante.
 */
export type CalendarDayState = DayVisualStatus | "draft" | "future" | "before_journey";

export const calendarExtraStateConfig: Record<
  Exclude<CalendarDayState, DayVisualStatus>,
  DayVisualStatusDefinition
> = {
  draft: {
    label: "Check-in en cours",
    description: "Un check-in a été commencé mais n'est pas terminé.",
    icon: PencilLine,
    className: {
      solid: "bg-card text-primary border-dashed border-primary/60",
      soft: "bg-card text-primary border border-dashed border-primary/60",
      text: "text-primary",
    },
  },
  future: {
    label: "À venir",
    description: "Cette journée n'est pas encore arrivée.",
    icon: Circle,
    className: {
      solid: "bg-transparent text-muted-foreground/50",
      soft: "bg-transparent text-muted-foreground/50 border border-dashed border-border",
      text: "text-muted-foreground",
    },
  },
  before_journey: {
    label: "Avant ton parcours",
    description: "Cette journée précède le début déclaré de ton parcours.",
    icon: Minus,
    className: {
      solid: "bg-transparent text-muted-foreground/40",
      soft: "bg-transparent text-muted-foreground/40",
      text: "text-muted-foreground",
    },
  },
};

/** Affichage (libellé, icône, classes) de n'importe quel état de journée. */
export function getDayStateDisplay(state: CalendarDayState): DayVisualStatusDefinition {
  return state in dayVisualStatusConfig
    ? dayVisualStatusConfig[state as DayVisualStatus]
    : calendarExtraStateConfig[state as Exclude<CalendarDayState, DayVisualStatus>];
}
