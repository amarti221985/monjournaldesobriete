import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/** Lien texte discret utilisé dans les écrans d'authentification. */
export function TextLink({ className, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(
        "font-medium text-primary underline-offset-4 hover:underline",
        className,
      )}
      {...props}
    />
  );
}
