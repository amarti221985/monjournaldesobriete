import { BookHeart, Crown, Heart, Mail, MapPin, MessageSquareQuote, Phone, Users } from "lucide-react";

import { Button } from "@/components/ui/button";

import { DEFAULT_LETTER_TITLE } from "@/features/plan/constants";
import { sortContacts, sortPlaces, toTelHref as telHref, type PlanPlace } from "@/features/plan/logic";

export type SupportContactView = {
  id: string;
  name: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
};

function Panel({ icon: Icon, title, open, children }: { icon: typeof Heart; title: string; open: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="group rounded-xl border bg-card">
      <summary className="flex min-h-12 cursor-pointer items-center gap-2.5 px-4 font-medium">
        <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
        {title}
      </summary>
      <div className="grid gap-3 px-4 pb-4">{children}</div>
    </details>
  );
}

/** « Voir mon rappel » : le rappel personnel du plan. */
export function ReminderPanel({ reminder, open = false }: { reminder: string; open?: boolean }) {
  return (
    <Panel icon={MessageSquareQuote} title="Voir mon rappel" open={open}>
      <p className="rounded-lg bg-secondary/60 p-3 text-pretty whitespace-pre-line">{reminder}</p>
    </Panel>
  );
}

/** « Changer d'endroit » : lieux sûrs du plan (favoris d'abord), texte seulement, aucune localisation. */
export function SafePlacesPanel({ places, open = false }: { places: PlanPlace[]; open?: boolean }) {
  return (
    <Panel icon={MapPin} title="Changer d'endroit" open={open}>
      {places.length === 0 ? (
        <p className="text-sm text-pretty text-muted-foreground">
          Va dans une autre pièce, sors dehors ou éloigne-toi du contexte. Tu pourras ajouter tes lieux sûrs dans Mon plan.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Tes lieux sûrs :</p>
          <ul className="grid gap-2">
            {sortPlaces(places).map((place) => (
              <li key={place.id} className="rounded-lg bg-muted/60 p-3">
                <p className="font-medium">{place.name}</p>
                {place.description ? <p className="text-sm text-pretty text-muted-foreground">{place.description}</p> : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

/** « Relire ma lettre » : jamais affichée d'emblée, l'utilisateur choisit de l'ouvrir. */
export function LetterPanel({ letter }: { letter: { title: string | null; content: string } }) {
  return (
    <Panel icon={BookHeart} title="Relire ma lettre" open={false}>
      <p className="font-medium">{letter.title || DEFAULT_LETTER_TITLE}</p>
      <p className="text-pretty whitespace-pre-line">{letter.content}</p>
    </Panel>
  );
}

/**
 * « Contacter quelqu'un » : contacts du Sprint 2, liens natifs de l'appareil (tel:,
 * mailto:). Aucune action n'est journalisée ni envoyée par le serveur.
 */
export function SupportContacts({ contacts, open = false }: { contacts: SupportContactView[]; open?: boolean }) {
  return (
    <details open={open} className="group rounded-xl border bg-card">
      <summary className="flex min-h-12 cursor-pointer items-center gap-2.5 px-4 font-medium">
        <Users className="size-4 shrink-0 text-primary" aria-hidden="true" />
        Contacter quelqu&apos;un
      </summary>
      <div className="grid gap-3 px-4 pb-4">
        {contacts.length === 0 ? (
          <p className="text-sm text-pretty text-muted-foreground">
            Tu n&apos;as pas encore de personne de soutien enregistrée. Tu pourras en ajouter une dans Mon plan.
          </p>
        ) : (
          <ul className="grid gap-3">
            {sortContacts(contacts).map((contact) => (
              <li key={contact.id} className="grid gap-2 rounded-lg bg-muted/60 p-3">
                <p>
                  <span className="font-medium">{contact.name}</span>
                  {contact.relationship ? <span className="text-muted-foreground"> · {contact.relationship}</span> : null}
                  {contact.isPrimary ? (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 align-middle text-xs text-secondary-foreground">
                      <Crown className="size-3" aria-hidden="true" />
                      Personne principale
                    </span>
                  ) : null}
                </p>
                {contact.phone || contact.email ? (
                  <div className="flex flex-wrap gap-2">
                    {contact.phone ? (
                      <Button asChild variant="outline" size="sm" className="min-h-10">
                        <a href={telHref(contact.phone)}>
                          <Phone data-icon="inline-start" aria-hidden="true" />
                          Appeler {contact.phone}
                        </a>
                      </Button>
                    ) : null}
                    {contact.email ? (
                      <Button asChild variant="outline" size="sm" className="min-h-10 max-w-full">
                        <a href={`mailto:${contact.email}`} className="truncate">
                          <Mail data-icon="inline-start" aria-hidden="true" />
                          Écrire
                        </a>
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucun moyen de contact enregistré.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

/** « Relire pourquoi j'ai commencé » : raison personnelle et quelques motivations. */
export function PersonalReasons({
  reason,
  motivations,
  open = false,
}: {
  reason: string | null;
  motivations: string[];
  open?: boolean;
}) {
  return (
    <details open={open} className="group rounded-xl border bg-card">
      <summary className="flex min-h-12 cursor-pointer items-center gap-2.5 px-4 font-medium">
        <Heart className="size-4 shrink-0 text-primary" aria-hidden="true" />
        Relire pourquoi j&apos;ai commencé
      </summary>
      <div className="grid gap-3 px-4 pb-4">
        {reason ? (
          <blockquote className="border-l-2 border-primary/40 pl-3 text-pretty whitespace-pre-line">{reason}</blockquote>
        ) : (
          <p className="text-sm text-muted-foreground">Aucune raison enregistrée pour l&apos;instant.</p>
        )}
        {motivations.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label="Mes motivations">
            {motivations.slice(0, 4).map((motivation) => (
              <li key={motivation} className="rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground">
                {motivation}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </details>
  );
}
