"use client";

import { Wind } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { cn } from "@/lib/utils";

type CravingCtaProps = {
  /** Moment en cours aujourd'hui : le CTA propose de le reprendre. */
  activeEventId: string | null;
  variant: "sidebar" | "header";
};

/**
 * CTA global « J'ai envie de consommer » : visible mais calme (variante secondaire,
 * jamais rouge ni « urgence »). Masqué sur les pages du mode envie elles-mêmes.
 */
export function CravingCta({ activeEventId, variant }: CravingCtaProps) {
  const pathname = usePathname();
  if (pathname === routes.craving || pathname.startsWith(`${routes.craving}/`)) return null;

  const href = activeEventId ? `${routes.craving}/${activeEventId}` : routes.craving;
  const full = activeEventId ? "Continuer mon intervention" : "J'ai envie de consommer";

  if (variant === "sidebar") {
    return (
      <Button asChild variant="secondary" className="h-auto min-h-11 w-full justify-start gap-2.5 px-3 py-2.5 text-left">
        <Link href={href}>
          <Wind className="size-[1.125rem] shrink-0" aria-hidden="true" />
          <span className="text-pretty">{full}</span>
        </Link>
      </Button>
    );
  }

  // En-tête mobile : libellé court visible, nom accessible complet (commence par le texte visible).
  return (
    <Button asChild variant="secondary" size="sm" className={cn("h-9 shrink-0 gap-1.5 px-3 lg:hidden")}>
      <Link href={href} aria-label={full}>
        <Wind className="size-4" aria-hidden="true" />
        {activeEventId ? "Continuer" : "J'ai envie"}
      </Link>
    </Button>
  );
}
