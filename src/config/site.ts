export const siteConfig = {
  name: "Mon Journal de Sobriété",
  shortName: "Mon Journal",
  tagline: "Un jour à la fois.",
  description:
    "Un journal personnel pour suivre sa sobriété, comprendre ses habitudes et reconnaître ses progrès.",
  locale: "fr",
  /**
   * Fuseau utilisé seulement si le profil n'en a pas encore (il est normalement
   * détecté à l'inscription ou à la première visite). Public cible : Québec / Canada.
   */
  defaultTimeZone: "America/Toronto",
  disclaimer:
    "Mon Journal de Sobriété est un outil de suivi et de réflexion personnelle. Il ne remplace pas un médecin, un psychologue ou un autre professionnel de la santé, ni les services d'urgence : en cas de danger, compose le 911.",
  /** Bêta V1 (Sprint 13) : badge discret près du nom, lien « Donner mon avis ». */
  isBeta: true,
} as const;

export type SiteConfig = typeof siteConfig;
