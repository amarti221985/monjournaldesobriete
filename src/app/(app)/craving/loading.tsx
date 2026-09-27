import { Skeleton } from "@/components/ui/skeleton";

/** Squelette du mode envie. */
export default function CravingLoading() {
  return (
    <div role="status" aria-live="polite" className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
      <span className="sr-only">Chargement…</span>
      <div className="grid gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-5 w-full max-w-lg" />
      </div>
      <div className="grid gap-4 rounded-2xl border bg-card p-4 sm:p-6">
        <Skeleton className="h-6 w-64 max-w-full" />
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-11">
          {Array.from({ length: 11 }, (_, index) => (
            <Skeleton key={index} className="h-11 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
