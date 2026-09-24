import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageContainerProps = {
  children: ReactNode;
  className?: string;
  /** Largeur maximale du contenu. */
  size?: "default" | "narrow" | "wide";
};

const sizeClassName = {
  narrow: "max-w-2xl",
  default: "max-w-4xl",
  wide: "max-w-6xl",
} as const;

export function PageContainer({ children, className, size = "default" }: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:py-10",
        sizeClassName[size],
        className,
      )}
    >
      {children}
    </div>
  );
}
