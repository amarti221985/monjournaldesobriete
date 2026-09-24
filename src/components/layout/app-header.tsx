import Link from "next/link";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/shared/brand-mark";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";

type AppHeaderProps = {
  actions?: ReactNode;
};

/** En-tête de la zone authentifiée : marque sur mobile, actions à droite. */
export function AppHeader({ actions }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6 lg:justify-end">
      <Link
        href={routes.today}
        className="flex min-w-0 items-center gap-2.5 font-semibold tracking-tight lg:hidden"
      >
        <BrandMark className="size-8 shrink-0" />
        <span className="truncate">{siteConfig.shortName}</span>
      </Link>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
