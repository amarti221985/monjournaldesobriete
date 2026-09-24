import { siteConfig } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-5xl px-4 pt-8 pb-10 sm:px-6">
      <p className="mx-auto max-w-2xl border-t pt-6 text-center text-sm text-pretty text-muted-foreground">
        {siteConfig.disclaimer}
      </p>
    </footer>
  );
}
