import { describe, expect, it } from "vitest";

import { buildFeedbackEmail, DEFAULT_FEEDBACK_FROM, resolveFeedbackNotificationConfig } from "@/features/feedback/notification";
import { feedbackSchema } from "@/features/feedback/schema";

describe("avis bêta", () => {
  it("valide catégorie, message et section", () => {
    expect(feedbackSchema.safeParse({ category: "bug", message: "  Un souci  ", section: null }).success).toBe(true);
    expect(feedbackSchema.safeParse({ category: "autre", message: "x", section: null }).success).toBe(false);
    expect(feedbackSchema.safeParse({ category: "bug", message: "   ", section: null }).success).toBe(false);
    expect(feedbackSchema.safeParse({ category: "bug", message: "x", section: "/journal/2026-09-27" }).success).toBe(false);
  });

  it("notification désactivée sans clé ou sans adresse valide ; expéditeur par défaut", () => {
    expect(resolveFeedbackNotificationConfig({ apiKey: undefined, to: "moi@exemple.ca", from: undefined })).toBeNull();
    expect(resolveFeedbackNotificationConfig({ apiKey: "re_test", to: "pas-une-adresse", from: undefined })).toBeNull();
    expect(resolveFeedbackNotificationConfig({ apiKey: "re_test", to: "moi@exemple.ca", from: undefined })).toEqual({
      apiKey: "re_test",
      to: "moi@exemple.ca",
      from: DEFAULT_FEEDBACK_FROM,
    });
  });

  it("courriel en texte brut : type, section, message ; jamais d'adresse ni d'identifiant", () => {
    const email = buildFeedbackEmail(
      { category: "confusing", message: "Je ne trouvais pas <b>le journal</b>.", section: "journal" },
      new Date("2026-09-27T12:00:00Z"),
    );
    expect(email.subject).toBe("Nouvel avis bêta : Je ne comprends pas");
    expect(email.text).toContain("Section : Journal");
    expect(email.text).toContain("Je ne trouvais pas <b>le journal</b>.");
    expect(email.text).not.toMatch(/@|user_id|[0-9a-f]{8}-[0-9a-f]{4}-/);
  });
});
