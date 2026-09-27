import { siteConfig } from "@/config/site";

/** Badge discret « Bêta » près du nom de l'application (texte, pas seulement une couleur). */
export function BetaBadge() {
  if (!siteConfig.isBeta) return null;
  return (
    <span className="inline-flex h-5 shrink-0 items-center rounded-full border border-primary/30 bg-secondary px-2 text-[0.6875rem] font-semibold tracking-wide text-secondary-foreground uppercase">
      Bêta
    </span>
  );
}
