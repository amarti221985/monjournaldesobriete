/*
 * Logique pure de « Mon plan » (Sprint 8) : ordre d'affichage (principal / favoris
 * d'abord), panneau « Ce qui peut m'aider maintenant » et options de stratégies du mode
 * envie. Le plan est choisi par l'utilisateur : rien n'y est déduit des statistiques.
 */

export type PlanStrategy = {
  id: string;
  /** Slug du catalogue (null pour une stratégie personnelle) */
  strategySlug: string | null;
  /** Nom affiché (catalogue ou personnel) */
  name: string;
  customName: string | null;
  notes: string | null;
  defaultDurationMinutes: number | null;
  isFavorite: boolean;
};

export type PlanContact = {
  id: string;
  name: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
};

export type PlanPlace = { id: string; name: string; description: string | null; isFavorite: boolean };

/** Favoris / principal d'abord, puis ordre d'origine (tri stable). */
export function favoritesFirst<T>(items: readonly T[], isFirst: (item: T) => boolean): T[] {
  return [...items.filter(isFirst), ...items.filter((item) => !isFirst(item))];
}

export const sortContacts = (contacts: readonly PlanContact[]) => favoritesFirst(contacts, (contact) => contact.isPrimary);
export const sortStrategies = (strategies: readonly PlanStrategy[]) =>
  favoritesFirst(strategies, (strategy) => strategy.isFavorite);
export const sortPlaces = (places: readonly PlanPlace[]) => favoritesFirst(places, (place) => place.isFavorite);

/** Nombre de favoris restants avant la limite (jamais négatif). */
export function remainingFavorites(items: readonly { isFavorite: boolean }[], max: number): number {
  return Math.max(0, max - items.filter((item) => item.isFavorite).length);
}

export type QuickSupport = {
  strategy: PlanStrategy | null;
  contact: PlanContact | null;
  place: PlanPlace | null;
  reminder: string | null;
};

/**
 * « Ce qui peut m'aider maintenant » : une stratégie favorite, la personne principale,
 * un lieu favori et le rappel. Uniquement ce que l'utilisateur a marqué ; rien d'inventé.
 */
export function buildQuickSupport(input: {
  strategies: readonly PlanStrategy[];
  contacts: readonly PlanContact[];
  places: readonly PlanPlace[];
  reminder: string | null;
}): QuickSupport {
  return {
    strategy: input.strategies.find((item) => item.isFavorite) ?? null,
    contact: input.contacts.find((item) => item.isPrimary) ?? null,
    place: input.places.find((item) => item.isFavorite) ?? null,
    reminder: input.reminder,
  };
}

export function hasQuickSupport(support: QuickSupport): boolean {
  return Boolean(support.strategy || support.contact || support.place || support.reminder);
}

// ---------------------------------------------------------------------------
// Options de stratégies du mode envie
// ---------------------------------------------------------------------------

export type CatalogueStrategy = { slug: string; name: string; description: string; defaultDurationMinutes: number | null };

export type StrategyOption = {
  /** Clé unique de l'option (formulaire) */
  key: string;
  title: string;
  description: string | null;
  /** Envoyé à start_craving_intervention : slug du catalogue… */
  strategySlug: string | null;
  /** … ou texte personnel copié dans l'intervention (l'historique ne dépend pas du plan) */
  customStrategyText: string | null;
  /** Durée proposée par défaut (plan, sinon aucune préférence) */
  defaultDurationMinutes: number | null;
  isFavorite: boolean;
};

/**
 * « Tes stratégies » (celles du plan, favoris d'abord) puis « Autres stratégies »
 * (catalogue non encore présent dans le plan).
 */
export function groupCravingStrategies(
  personal: readonly PlanStrategy[],
  catalogue: readonly CatalogueStrategy[],
): { yours: StrategyOption[]; others: StrategyOption[] } {
  const catalogueBySlug = new Map(catalogue.map((item) => [item.slug, item]));
  const yours = sortStrategies(personal).map((item): StrategyOption => {
    const fromCatalogue = item.strategySlug ? catalogueBySlug.get(item.strategySlug) : undefined;
    return {
      key: `plan:${item.id}`,
      title: item.name,
      description: item.notes ?? fromCatalogue?.description ?? null,
      strategySlug: item.strategySlug,
      customStrategyText: item.strategySlug ? null : (item.customName ?? item.name),
      defaultDurationMinutes: item.defaultDurationMinutes,
      isFavorite: item.isFavorite,
    };
  });
  const inPlan = new Set(personal.map((item) => item.strategySlug).filter(Boolean));
  const others = catalogue
    .filter((item) => !inPlan.has(item.slug))
    .map(
      (item): StrategyOption => ({
        key: `catalogue:${item.slug}`,
        title: item.name,
        description: item.description,
        strategySlug: item.slug,
        customStrategyText: null,
        defaultDurationMinutes: null,
        isFavorite: false,
      }),
    );
  return { yours, others };
}

/** Numéro utilisable dans un lien tel: (chiffres et « + » seulement). */
export function toTelHref(phone: string): string {
  return `tel:${phone.replace(/[^0-9+]/g, "")}`;
}
