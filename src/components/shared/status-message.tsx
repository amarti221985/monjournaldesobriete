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
}: StatusMessageProps) {
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
      <h1 className="text-xl font-semibold tracking-tight text-balance">{title}</h1>
      {description ? (
        <p className="text-pretty text-muted-foreground">{description}</p>
      ) : null}
      {children ? (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">{children}</div>
      ) : null}
    </div>
  );
}
