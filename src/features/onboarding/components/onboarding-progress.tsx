import { Progress } from "@/components/ui/progress";
import { ONBOARDING_STEP_COUNT } from "@/features/onboarding/constants";

type OnboardingProgressProps = {
  stepIndex: number;
  stepTitle: string;
};

export function OnboardingProgress({ stepIndex, stepTitle }: OnboardingProgressProps) {
  const stepNumber = stepIndex + 1;
  const label = `Étape ${stepNumber} sur ${ONBOARDING_STEP_COUNT}`;

  return (
    <div className="grid gap-2">
      <p className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="truncate text-muted-foreground">{stepTitle}</span>
      </p>
      <Progress
        value={(stepNumber / ONBOARDING_STEP_COUNT) * 100}
        aria-label={`Progression : ${label}`}
        className="h-1.5"
      />
    </div>
  );
}
