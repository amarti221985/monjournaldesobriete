import { OTHER_SUBSTANCE_SLUG } from "@/features/onboarding/constants";
import type { CatalogueOption } from "@/features/onboarding/components/step-types";

/** Nom affiché : précision personnelle pour « Autre », sinon le nom du catalogue. */
export function getSubstanceDisplayName(
  catalogue: readonly CatalogueOption[],
  slug: string,
  customName?: string,
): string {
  if (slug === OTHER_SUBSTANCE_SLUG && customName?.trim()) return customName.trim();
  return catalogue.find((substance) => substance.slug === slug)?.name_fr ?? slug;
}
