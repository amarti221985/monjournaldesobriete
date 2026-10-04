"use client";

import { ArrowLeft, BarChart3, LayoutDashboard, MessageSquareText, Repeat, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { routes } from "@/config/routes";
import { cn } from "@/lib/utils";

const items = [
  { href: routes.admin, label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: routes.adminAnalytics, label: "Analytics", icon: BarChart3 },
  { href: routes.adminRetention, label: "Rétention", icon: Repeat },
  { href: routes.adminUsers, label: "Utilisateurs", icon: Users },
  { href: routes.adminFeedback, label: "Avis", icon: MessageSquareText },
] as const;

function isActive(pathname: string, href: string) {
  return href === routes.admin ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/** Navigation de l'administration : barre latérale (desktop) ou rangée défilante (mobile). */
export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation de l'administration">
      <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors motion-reduce:transition-none",
                  "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
        <li className="shrink-0 lg:mt-4 lg:border-t lg:pt-4">
          <Link
            href={routes.today}
            className="flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Retour à l&apos;application
          </Link>
        </li>
      </ul>
    </nav>
  );
}
