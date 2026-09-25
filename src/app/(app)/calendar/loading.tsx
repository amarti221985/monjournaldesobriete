import { Skeleton } from "@/components/ui/skeleton";

/** Squelette du calendrier : aucune journée « sobre » affichée pendant le chargement. */
export default function CalendarLoading() {
  return (
    <div role="status" aria-live="polite" className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
      <span className="sr-only">Chargement du calendrier…</span>
      <div className="grid gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-5 w-72 max-w-full" />
      </div>
      <div className="grid gap-4 rounded-xl border bg-card p-4 sm:p-6">
        <Skeleton className="h-10 w-full sm:w-48" />
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 35 }, (_, index) => (
            <Skeleton key={index} className="h-12 rounded-lg sm:h-16" />
          ))}
        </div>
      </div>
    </div>
  );
}
