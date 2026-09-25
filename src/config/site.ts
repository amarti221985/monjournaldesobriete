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
    "Mon Journal de Sobriété est un outil de journalisation et de suivi personnel. Il ne remplace pas les conseils ou soins d'un professionnel de la santé.",
} as const;

export type SiteConfig = typeof siteConfig;
