import { Skeleton } from "@/components/ui/skeleton";

export default function JournalLoading() {
  return (
    <div role="status" aria-live="polite" className="mx-auto grid w-full max-w-2xl gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
      <span className="sr-only">Chargement du journal…</span>
      <div className="grid gap-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>
      <Skeleton className="h-40 rounded-2xl" />
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton key={index} className="h-44 rounded-2xl" />
      ))}
    </div>
  );
}
