import { Skeleton } from "@/components/ui/skeleton";

/** Squelette de « Mes bilans » : aucun contenu pendant le chargement. */
export default function InsightsLoading() {
  return (
    <div role="status" aria-live="polite" className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
      <span className="sr-only">Chargement de tes bilans…</span>
      <div className="grid gap-2">
        <Skeleton className="h-8 w-48 max-w-full" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>
      <Skeleton className="h-64 rounded-2xl" />
      <Skeleton className="h-24 rounded-2xl" />
    </div>
  );
}
