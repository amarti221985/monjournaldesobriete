"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import type { NavigationItem } from "@/config/navigation";
import { isPathWithin } from "@/lib/auth/redirects";
import { cn } from "@/lib/utils";

type NavLinkProps = {
  /** Données sérialisables uniquement (le composant d'icône ne peut pas traverser la frontière serveur/client). */
  item: Omit<NavigationItem, "icon">;
  /** Icône déjà rendue par le composant serveur parent. */
  icon: ReactNode;
  variant: "sidebar" | "bottom-bar";
};

const SOON_LABEL = "Bientôt";

/**
 * Lien de navigation de l'app avec état actif (aria-current).
 * Une section non disponible est rendue comme élément désactivé, jamais comme lien cassé.
 */
export function NavLink({ item, icon, variant }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = item.available && isPathWithin(pathname, item.href);

  if (variant === "bottom-bar") {
    const className = cn(
      "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[0.7rem] font-medium transition-colors",
      !item.available && "text-muted-foreground/60",
      item.available && (isActive ? "font-semibold text-primary" : "text-muted-foreground hover:text-foreground"),
    );
    const content = (
      <>
        {icon}
        <span className="max-w-full truncate">{item.shortLabel}</span>
      </>
    );

    if (!item.available) {
      return (
        <span aria-disabled="true" className={className}>
          {content}
          <span className="sr-only"> ({SOON_LABEL.toLowerCase()})</span>
        </span>
      );
    }

    return (
      <Link href={item.href} aria-current={isActive ? "page" : undefined} className={cn(className, "relative")}>
        {/* Indicateur actif visible sans la couleur : barre au-dessus de l'icône */}
        {isActive ? <span aria-hidden="true" className="absolute top-0 h-1 w-8 rounded-b-full bg-primary" /> : null}
        {content}
      </Link>
    );
  }

  const className = cn(
    "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
    !item.available && "text-muted-foreground/60",
    item.available &&
      (isActive
        ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground shadow-[inset_3px_0_0_var(--primary)]"
        : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"),
  );

  if (!item.available) {
    return (
      <span aria-disabled="true" className={className}>
        {icon}
        <span className="flex-1">{item.label}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground">
          {SOON_LABEL}
        </span>
      </span>
    );
  }

  return (
    <Link href={item.href} aria-current={isActive ? "page" : undefined} className={className}>
      {icon}
      <span>{item.label}</span>
    </Link>
  );
}
