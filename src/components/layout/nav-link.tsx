"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { NavigationItem } from "@/config/navigation";
import { cn } from "@/lib/utils";

type NavLinkProps = {
  item: NavigationItem;
  variant: "sidebar" | "bottom-bar";
};

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Lien de navigation de l'app avec état actif (aria-current). */
export function NavLink({ item, variant }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = isActivePath(pathname, item.href);
  const Icon = item.icon;

  if (variant === "bottom-bar") {
    return (
      <Link
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[0.7rem] font-medium transition-colors",
          isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Icon className="size-5" aria-hidden="true" />
        <span className="truncate">{item.shortLabel}</span>
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
      )}
    >
      <Icon className="size-[1.125rem]" aria-hidden="true" />
      <span>{item.label}</span>
    </Link>
  );
}
