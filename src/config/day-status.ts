import {
  CircleCheck,
  CircleDashed,
  CircleDot,
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
