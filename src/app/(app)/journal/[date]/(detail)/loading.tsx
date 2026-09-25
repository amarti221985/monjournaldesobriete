import { Skeleton } from "@/components/ui/skeleton";

export default function JournalDayLoading() {
  return (
    <div role="status" aria-live="polite" className="mx-auto grid w-full max-w-2xl gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
      <span className="sr-only">Chargement de la journée…</span>
      <Skeleton className="h-9 w-28" />
      <div className="grid gap-3">
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-8 w-40" />
      </div>
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}
