import type { StepErrors } from "@/features/onboarding/logic";
import type { OnboardingDraft } from "@/features/onboarding/schemas";

/** Propriétés communes aux étapes du wizard. */
export type StepProps = {
  draft: OnboardingDraft;
  onChange: (patch: Partial<OnboardingDraft>) => void;
  errors: StepErrors;
};

/** Substance du catalogue, telle que transmise par le serveur. */
export type CatalogueOption = {
  slug: string;
  name_fr: string;
  category: string;
};
