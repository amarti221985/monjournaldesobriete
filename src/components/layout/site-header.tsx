import Link from "next/link";

import { BrandMark } from "@/components/shared/brand-mark";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
      <Link
        href={routes.home}
        className="flex min-w-0 items-center gap-2.5 font-semibold tracking-tight"
      >
        <BrandMark className="size-9 shrink-0" />
        <span className="truncate sm:hidden">{siteConfig.shortName}</span>
        <span className="hidden truncate sm:inline">{siteConfig.name}</span>
      </Link>
      <Button asChild variant="ghost" className="shrink-0">
        <Link href={routes.login}>Se connecter</Link>
      </Button>
    </header>
  );
}
