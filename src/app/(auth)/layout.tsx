import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { BrandMark } from "@/components/shared/brand-mark";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-md items-center justify-center px-4 pt-8 pb-6 sm:pt-14">
        <Link
          href={routes.home}
          className="flex items-center gap-2.5 font-semibold tracking-tight"
        >
          <BrandMark className="size-9" />
          <span>{siteConfig.name}</span>
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 sm:px-0">{children}</main>

      <footer className="mx-auto flex w-full max-w-md justify-center px-4 py-8">
        <Link
          href={routes.home}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Retour à l&apos;accueil
        </Link>
      </footer>
    </div>
  );
}
