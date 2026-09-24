import { Sprout } from "lucide-react";

import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
};

/** Logo temporaire : pictogramme décoratif (le nom est toujours affiché à côté). */
export function BrandMark({ className }: BrandMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground",
        className,
      )}
    >
      <Sprout className="size-5" strokeWidth={2} />
    </span>
  );
}
