"use client";

import { Crown, Mail, Phone } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  addContactAction,
  addPlaceAction,
  deletePlanItemAction,
  setFavoriteAction,
  setPrimaryContactAction,
  updateContactAction,
  updatePlaceAction,
} from "@/features/plan/actions";
import { MAX_PLAN_FAVORITES, MAX_SUPPORT_CONTACTS, PLAN_TEXT_LIMITS, SAFE_PLACE_EXAMPLES } from "@/features/plan/constants";
import { remainingFavorites, sortContacts, sortPlaces, toTelHref, type PlanContact, type PlanPlace } from "@/features/plan/logic";
import {
  AddButton,
  ConfirmedActionButton,
  EditButton,
  EmptyState,
  FavoriteButton,
  FormActions,
  PlanSection,
  StatusLine,
  TextAreaField,
  TextField,
  usePlanAction,
  useUnsavedGuard,
} from "@/features/plan/components/plan-ui";

// --- Personnes de soutien -----------------------------------------------------------

type ContactDraft = { name: string; relationship: string; phone: string; email: string };

function ContactForm({ contact, onClose }: { contact?: PlanContact; onClose: () => void }) {
  const action = usePlanAction();
  const initial: ContactDraft = {
    name: contact?.name ?? "",
    relationship: contact?.relationship ?? "",
    phone: contact?.phone ?? "",
    email: contact?.email ?? "",
  };
  const [draft, setDraft] = useState(initial);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  useUnsavedGuard(dirty);
  const key = contact?.id ?? "new";
  const set = (patch: Partial<ContactDraft>) => setDraft((current) => ({ ...current, ...patch }));

  return (
    <form
      className="grid gap-4 rounded-xl bg-muted/50 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        action.run(() => (contact ? updateContactAction({ id: contact.id, ...draft }) : addContactAction(draft)), onClose);
      }}
    >
      <TextField id={`contact-name-${key}`} label="Nom ou prénom" value={draft.name} onChange={(name) => set({ name })} max={80} />
      <TextField id={`contact-relationship-${key}`} label="Relation" hint="Facultatif." value={draft.relationship} onChange={(relationship) => set({ relationship })} max={60} placeholder="Ex. Sœur, ami, parrain" />
      <TextField id={`contact-phone-${key}`} label="Téléphone" hint="Facultatif." value={draft.phone} onChange={(phone) => set({ phone })} max={32} />
      <TextField id={`contact-email-${key}`} label="Courriel" hint="Facultatif." value={draft.email} onChange={(email) => set({ email })} max={254} />
      <StatusLine error={action.error} saved={false} />
      <FormActions pending={action.isPending} dirty={dirty} onCancel={onClose} submitLabel={contact ? "Enregistrer" : "Ajouter"} retry={Boolean(action.error)} />
    </form>
  );
}

/** « Mes personnes de soutien » : table support_contacts du Sprint 2, une personne principale au plus. */
export function SupportSection({ contacts }: { contacts: PlanContact[] }) {
  const action = usePlanAction();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const addButton = contacts.length < MAX_SUPPORT_CONTACTS ? <AddButton label="Ajouter une personne" onClick={() => setAdding(true)} /> : null;

  return (
    <PlanSection
      id="soutien"
      title="Mes personnes de soutien"
      description="Les personnes vers qui tu peux te tourner."
      action={contacts.length > 0 && !adding ? addButton : null}
    >
      {contacts.length === 0 && !adding ? (
        <EmptyState text="Tu peux ajouter une personne que tu aimerais pouvoir contacter lorsque tu en as besoin." action={addButton} />
      ) : null}
      <ul className="grid gap-3">
        {sortContacts(contacts).map((contact) => (
          <li key={contact.id} className="grid gap-3 rounded-xl border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
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
            </div>
            {editing === contact.id ? (
              <ContactForm contact={contact} onClose={() => setEditing(null)} />
            ) : (
              <div className="flex flex-wrap gap-2">
                {contact.phone ? (
                  <Button asChild variant="outline" size="sm" className="min-h-10">
                    <a href={toTelHref(contact.phone)}>
                      <Phone data-icon="inline-start" aria-hidden="true" />
                      Appeler {contact.phone}
                    </a>
                  </Button>
                ) : null}
                {contact.email ? (
                  <Button asChild variant="outline" size="sm" className="min-h-10">
                    <a href={`mailto:${contact.email}`}>
                      <Mail data-icon="inline-start" aria-hidden="true" />
                      Écrire
                    </a>
                  </Button>
                ) : null}
                <EditButton label="Modifier" onClick={() => setEditing(contact.id)} />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-9"
                  disabled={action.isPending}
                  onClick={() => action.run(() => setPrimaryContactAction(contact.isPrimary ? null : contact.id))}
                >
                  {contact.isPrimary ? "Retirer comme principale" : "Définir comme principale"}
                </Button>
                <ConfirmedActionButton
                  label="Supprimer"
                  accessibleLabel={`Supprimer : ${contact.name}`}
                  title={`Supprimer « ${contact.name} » ?`}
                  description="Cette personne sera retirée de ton plan. Tes interventions passées ne sont pas modifiées."
                  confirmLabel="Supprimer"
                  pending={action.isPending}
                  onConfirm={() => action.run(() => deletePlanItemAction("contact", contact.id))}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
      {adding ? <ContactForm onClose={() => setAdding(false)} /> : null}
      <StatusLine error={action.error} saved={action.saved} />
    </PlanSection>
  );
}

// --- Lieux sûrs ---------------------------------------------------------------------

function PlaceForm({ place, onClose }: { place?: PlanPlace; onClose: () => void }) {
  const action = usePlanAction();
  const [name, setName] = useState(place?.name ?? "");
  const [description, setDescription] = useState(place?.description ?? "");
  const dirty = name !== (place?.name ?? "") || description !== (place?.description ?? "");
  useUnsavedGuard(dirty);
  const key = place?.id ?? "new";
  return (
    <form
      className="grid gap-4 rounded-xl bg-muted/50 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        action.run(
          () => (place ? updatePlaceAction({ id: place.id, name, description }) : addPlaceAction({ name, description })),
          onClose,
        );
      }}
    >
      <TextField
        id={`place-name-${key}`}
        label="Nom du lieu"
        value={name}
        onChange={setName}
        max={PLAN_TEXT_LIMITS.placeName}
        hint={`Quelques mots suffisent, sans adresse. Ex. ${SAFE_PLACE_EXAMPLES.slice(0, 3).join(", ")}.`}
      />
      <TextAreaField id={`place-description-${key}`} label="Pourquoi ce lieu m'aide" hint="Facultatif." value={description} onChange={setDescription} max={PLAN_TEXT_LIMITS.placeDescription} rows={2} />
      <StatusLine error={action.error} saved={false} />
      <FormActions pending={action.isPending} dirty={dirty} onCancel={onClose} submitLabel={place ? "Enregistrer" : "Ajouter"} retry={Boolean(action.error)} />
    </form>
  );
}

/** « Mes lieux sûrs » : texte libre uniquement, aucune géolocalisation ni adresse demandée. */
export function PlacesSection({ places }: { places: PlanPlace[] }) {
  const action = usePlanAction();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const remaining = remainingFavorites(places, MAX_PLAN_FAVORITES);
  const addButton = <AddButton label="Ajouter un lieu" onClick={() => setAdding(true)} />;

  return (
    <PlanSection
      id="lieux"
      title="Mes lieux sûrs"
      description="Des endroits où tu te sens plus calme, soutenu ou éloigné d'un contexte difficile."
      action={places.length > 0 && !adding ? addButton : null}
    >
      {places.length === 0 && !adding ? (
        <EmptyState text="Ajoute des endroits où tu te sens généralement plus calme ou soutenu." action={addButton} />
      ) : null}
      <ul className="grid gap-3">
        {sortPlaces(places).map((place) => (
          <li key={place.id} className="grid gap-2 rounded-xl border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="grid gap-1">
                <p className="font-medium">{place.name}</p>
                {place.description ? <p className="text-sm text-pretty text-muted-foreground">{place.description}</p> : null}
              </div>
              {editing !== place.id ? (
                <div className="flex flex-wrap gap-1">
                  <FavoriteButton
                    active={place.isFavorite}
                    label={place.name}
                    disabled={action.isPending || (!place.isFavorite && remaining === 0)}
                    onToggle={() => action.run(() => setFavoriteAction("place", { id: place.id, favorite: !place.isFavorite }))}
                  />
                  <EditButton label="Modifier" onClick={() => setEditing(place.id)} />
                  <ConfirmedActionButton
                    label="Supprimer"
                    accessibleLabel={`Supprimer : ${place.name}`}
                    title={`Supprimer « ${place.name} » ?`}
                    description="Ce lieu sera retiré de ton plan."
                    confirmLabel="Supprimer"
                    pending={action.isPending}
                    onConfirm={() => action.run(() => deletePlanItemAction("place", place.id))}
                  />
                </div>
              ) : null}
            </div>
            {editing === place.id ? <PlaceForm place={place} onClose={() => setEditing(null)} /> : null}
          </li>
        ))}
      </ul>
      {adding ? <PlaceForm onClose={() => setAdding(false)} /> : null}
      <StatusLine error={action.error} saved={action.saved} />
    </PlanSection>
  );
}
