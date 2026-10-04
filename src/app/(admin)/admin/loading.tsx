import { Skeleton } from "@/components/ui/skeleton";

/** Squelette de l'administration : aucun chiffre pendant le chargement. */
export default function AdminLoading() {
  return (
    <div role="status" aria-live="polite" className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
      <span className="sr-only">Chargement de l&apos;administration…</span>
      <div className="grid gap-2">
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}
