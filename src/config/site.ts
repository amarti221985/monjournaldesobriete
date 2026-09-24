export const siteConfig = {
  name: "Mon Journal de Sobriété",
  shortName: "Mon Journal",
  tagline: "Un jour à la fois.",
  description:
    "Un journal personnel pour suivre sa sobriété, comprendre ses habitudes et reconnaître ses progrès.",
  locale: "fr",
  disclaimer:
    "Mon Journal de Sobriété est un outil de journalisation et de suivi personnel. Il ne remplace pas les conseils ou soins d'un professionnel de la santé.",
} as const;

export type SiteConfig = typeof siteConfig;
