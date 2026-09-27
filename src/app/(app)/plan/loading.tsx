import { Skeleton } from "@/components/ui/skeleton";

/** Squelette de « Mon plan » : aucune donnée personnelle fictive affichée. */
export default function PlanLoading() {
  return (
    <div role="status" aria-live="polite" className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
      <span className="sr-only">Chargement de ton plan…</span>
      <div className="grid gap-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[13rem_1fr]">
        <div className="hidden gap-2 lg:grid">
          {Array.from({ length: 9 }, (_, index) => (
            <Skeleton key={index} className="h-8" />
          ))}
        </div>
        <div className="grid gap-6">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-40 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
