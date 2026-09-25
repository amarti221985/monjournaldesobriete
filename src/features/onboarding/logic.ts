import {
  OTHER_SUBSTANCE_SLUG,
  type OnboardingStepId,
} from "@/features/onboarding/constants";
import {
  createOnboardingCompletionSchema,
  createStartDateSchema,
  motivationOtherSchema,
  motivationsSchema,
  reasonSchema,
  substanceGoalSchema,
  substanceSelectionSchema,
  supportContactSchema,
  type OnboardingDraft,
} from "@/features/onboarding/schemas";

/** Erreurs d'une étape, par identifiant de champ (ex. `goal-cannabis`, `contact.name`). */
export type StepErrors = Record<string, string>;

type SupportContactDraft = NonNullable<OnboardingDraft["supportContact"]>;

/**
 * Substance principale : la seule sélectionnée, sinon le choix de l'utilisateur
 * s'il fait toujours partie de la sélection, sinon la première sélectionnée.
 */
export function resolvePrimarySlug(
  selectedSlugs: readonly string[],
  preferredSlug?: string,
): string | undefined {
  if (preferredSlug && selectedSlugs.includes(preferredSlug)) return preferredSlug;
  return selectedSlugs[0];
}

/** Vrai si au moins un champ du contact de soutien est renseigné. */
export function hasSupportContactInput(contact: OnboardingDraft["supportContact"]): contact is SupportContactDraft {
  return Boolean(contact && Object.values(contact).some((value) => value?.trim()));
}

/** Transforme le brouillon en données de finalisation (validées ensuite par Zod). */
export function buildCompletionPayload(draft: OnboardingDraft) {
  const substances = (draft.substances ?? []).map(({ slug, customName, goal }) => ({
    slug,
    customName: slug === OTHER_SUBSTANCE_SLUG ? customName : undefined,
    goal,
  }));
  const motivations = draft.motivations ?? [];

  return {
    substances,
    primarySlug: resolvePrimarySlug(
      substances.map((substance) => substance.slug),
      draft.primarySlug,
    ),
    startedOn: draft.startedOn ?? "",
    reason: draft.reason ?? "",
    motivations,
    motivationOther: motivations.includes("other") ? draft.motivationOther : undefined,
    supportContact: hasSupportContactInput(draft.supportContact) ? draft.supportContact : null,
  };
}

function firstMessage(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Valeur invalide.";
}

/** Validation d'une étape du wizard avant de passer à la suivante. */
export function validateStep(
  stepId: OnboardingStepId,
  draft: OnboardingDraft,
  latestAllowedDate: string,
): StepErrors {
  const errors: StepErrors = {};

  switch (stepId) {
    case "welcome":
      break;

    case "substances": {
      const result = substanceSelectionSchema.safeParse(draft.substances ?? []);
      if (!result.success) {
        const customNameIssue = result.error.issues.find((issue) => issue.path.includes("customName"));
        if (customNameIssue) errors.customName = customNameIssue.message;
        else errors.substances = firstMessage(result.error);
      }
      break;
    }

    case "goals": {
      const substances = draft.substances ?? [];
      for (const substance of substances) {
        if (!substanceGoalSchema.safeParse(substance.goal).success) {
          errors[`goal-${substance.slug}`] = "Choisis un objectif.";
        }
      }
      if (substances.length > 1) {
        const primary = draft.primarySlug;
        if (!primary || !substances.some((substance) => substance.slug === primary)) {
          errors.primarySlug = "Choisis ce que tu souhaites principalement changer.";
        }
      }
      break;
    }

    case "start": {
      const result = createStartDateSchema(latestAllowedDate).safeParse(draft.startedOn ?? "");
      if (!result.success) errors.startedOn = firstMessage(result.error);
      break;
    }

    case "reason": {
      const result = reasonSchema.safeParse(draft.reason ?? "");
      if (!result.success) errors.reason = firstMessage(result.error);
      break;
    }

    case "motivations": {
      const result = motivationsSchema.safeParse(draft.motivations ?? []);
      if (!result.success) errors.motivations = firstMessage(result.error);
      const other = motivationOtherSchema.safeParse(draft.motivationOther);
      if (!other.success) errors.motivationOther = firstMessage(other.error);
      break;
    }

    case "support": {
      if (hasSupportContactInput(draft.supportContact)) {
        const result = supportContactSchema.safeParse(draft.supportContact);
        if (!result.success) {
          for (const issue of result.error.issues) {
            const key = `contact.${String(issue.path[0])}`;
            errors[key] ??= issue.message;
          }
        }
      }
      break;
    }

    case "summary": {
      const result = createOnboardingCompletionSchema(latestAllowedDate).safeParse(
        buildCompletionPayload(draft),
      );
      if (!result.success) errors.form = "Certaines réponses sont incomplètes. Utilise « Modifier » pour les vérifier.";
      break;
    }
  }

  return errors;
}
