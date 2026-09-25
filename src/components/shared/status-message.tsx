import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type StatusMessageProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Actions (boutons, liens) affichées sous le message. */
  children?: ReactNode;
  className?: string;
  /** Niveau du titre : h1 pour une page d'état, h2/h3 à l'intérieur d'une page. */
  headingLevel?: "h1" | "h2" | "h3";
};

/**
 * Message centré réutilisable pour les états vides, d'erreur et 404.
 */
export function StatusMessage({
  icon: Icon,
  title,
  description,
  children,
  className,
  headingLevel = "h1",
}: StatusMessageProps) {
  const Heading = headingLevel;
  return (
    <div
      className={cn(
        "mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="inline-flex size-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground"
      >
        <Icon className="size-6" />
      </span>
      <Heading className="text-xl font-semibold tracking-tight text-balance">{title}</Heading>
      {description ? (
        <p className="text-pretty text-muted-foreground">{description}</p>
      ) : null}
      {children ? (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">{children}</div>
      ) : null}
    </div>
  );
}
