import Link from "next/link";
import type { ReactNode } from "react";

import { NavLink } from "@/components/layout/nav-link";
import { BetaBadge } from "@/components/shared/beta-badge";
import { BrandMark } from "@/components/shared/brand-mark";
import { Separator } from "@/components/ui/separator";
import { primaryNavigation, secondaryNavigation } from "@/config/navigation";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";

/** Navigation latérale, visible à partir du breakpoint lg. */
export function DesktopSidebar({ action }: { action?: ReactNode }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-sidebar px-3 py-5 text-sidebar-foreground lg:flex">
      <Link
        href={routes.today}
        className="mb-6 flex items-center gap-2.5 px-3 font-semibold tracking-tight"
      >
        <BrandMark className="size-8" />
        <span className="truncate">{siteConfig.shortName}</span>
        <BetaBadge />
      </Link>
      {action ? <div className="mb-4">{action}</div> : null}
      <nav aria-label="Navigation principale" className="flex flex-1 flex-col">
        <ul className="flex flex-col gap-1">
          {primaryNavigation.map((item) => (
            <li key={item.href}>
              <NavLink
                item={{ label: item.label, shortLabel: item.shortLabel, href: item.href, available: item.available }}
                icon={<item.icon className="size-[1.125rem]" aria-hidden="true" />}
                variant="sidebar"
              />
            </li>
          ))}
        </ul>
        <Separator className="my-4 mt-auto" />
        <ul className="flex flex-col gap-1">
          {secondaryNavigation.map((item) => (
            <li key={item.href}>
              <NavLink
                item={{ label: item.label, shortLabel: item.shortLabel, href: item.href, available: item.available }}
                icon={<item.icon className="size-[1.125rem]" aria-hidden="true" />}
                variant="sidebar"
              />
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
