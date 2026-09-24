import {
  BookOpen,
  CalendarDays,
  Compass,
  Settings,
  Sun,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import { routes, type AppRoute } from "@/config/routes";

export type NavigationItem = {
  label: string;
  /** Libellé court utilisé dans la navigation mobile. */
  shortLabel: string;
  href: AppRoute;
  icon: LucideIcon;
};

/** Navigation principale de l'application authentifiée (sidebar + barre mobile). */
export const primaryNavigation: readonly NavigationItem[] = [
  { label: "Aujourd'hui", shortLabel: "Aujourd'hui", href: routes.today, icon: Sun },
  { label: "Calendrier", shortLabel: "Calendrier", href: routes.calendar, icon: CalendarDays },
  { label: "Journal", shortLabel: "Journal", href: routes.journal, icon: BookOpen },
  { label: "Progression", shortLabel: "Progression", href: routes.progress, icon: TrendingUp },
  { label: "Mon plan", shortLabel: "Plan", href: routes.plan, icon: Compass },
];

/** Navigation secondaire, affichée en bas de la sidebar desktop. */
export const secondaryNavigation: readonly NavigationItem[] = [
  { label: "Paramètres", shortLabel: "Paramètres", href: routes.settings, icon: Settings },
];
