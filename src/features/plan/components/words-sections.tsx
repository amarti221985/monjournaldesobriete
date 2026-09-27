"use client";

import { useState } from "react";

import { deleteLetterAction, deleteReminderAction, saveLetterAction, saveReminderAction } from "@/features/plan/actions";
import { DEFAULT_LETTER_TITLE, PLAN_TEXT_LIMITS, REMINDER_PLACEHOLDER } from "@/features/plan/constants";
import {
  AddButton,
  ConfirmedActionButton,
  EditButton,
  EmptyState,
  FormActions,
  PlanSection,
  StatusLine,
  TextAreaField,
  TextField,
  usePlanAction,
  useUnsavedGuard,
} from "@/features/plan/components/plan-ui";

/** « Mon rappel » : un rappel principal (le texte d'exemple n'est jamais enregistré). */
export function ReminderSection({ reminder }: { reminder: string | null }) {
  const action = usePlanAction();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(reminder ?? "");
  const dirty = editing && value !== (reminder ?? "");
  useUnsavedGuard(dirty);

  return (
    <PlanSection
      id="rappel"
      title="Mon rappel"
      description="Qu'aimerais-tu te rappeler lorsque les choses deviennent difficiles ?"
      action={!editing && reminder ? <EditButton label="Modifier" onClick={() => setEditing(true)} /> : null}
    >
      {editing ? (
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            action.run(() => saveReminderAction({ content: value }), () => setEditing(false));
          }}
        >
          <TextAreaField
            id="reminder"
            label="Mon rappel"
            value={value}
            onChange={setValue}
            max={PLAN_TEXT_LIMITS.reminder}
            placeholder={REMINDER_PLACEHOLDER}
          />
          <StatusLine error={action.error} saved={false} />
          <FormActions
            pending={action.isPending}
            dirty={dirty}
            retry={Boolean(action.error)}
            onCancel={() => {
              setValue(reminder ?? "");
              setEditing(false);
              action.clearError();
            }}
          />
        </form>
      ) : reminder ? (
        <>
          <p className="rounded-xl bg-secondary/60 p-4 text-pretty whitespace-pre-line">{reminder}</p>
          <div>
            <ConfirmedActionButton
              label="Supprimer"
              accessibleLabel="Supprimer mon rappel"
              title="Supprimer ton rappel ?"
              description="Tu pourras en écrire un nouveau à tout moment."
              confirmLabel="Supprimer"
              pending={action.isPending}
              onConfirm={() => {
                setValue("");
                action.run(() => deleteReminderAction());
              }}
            />
          </div>
        </>
      ) : (
        <EmptyState
          text="Une phrase simple, écrite pour toi, que tu pourras relire pendant une envie."
          action={<AddButton label="Écrire mon rappel" onClick={() => setEditing(true)} />}
        />
      )}
      {!editing ? <StatusLine error={action.error} saved={action.saved} /> : null}
    </PlanSection>
  );
}

/**
 * « Ma lettre à moi-même » : donnée particulièrement privée. Jamais dans une URL, un
 * journal ni un service tiers ; repliée par défaut (lue seulement si on l'ouvre).
 */
export function LetterSection({ letter }: { letter: { title: string | null; content: string } | null }) {
  const action = usePlanAction();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(letter?.title ?? "");
  const [content, setContent] = useState(letter?.content ?? "");
  const dirty = editing && (title !== (letter?.title ?? "") || content !== (letter?.content ?? ""));
  useUnsavedGuard(dirty);

  return (
    <PlanSection
      id="lettre"
      title="Ma lettre à moi-même"
      description="Écris quelques mots que tu aimerais pouvoir relire lors d'une journée difficile."
      action={!editing && letter ? <EditButton label="Modifier" onClick={() => setEditing(true)} /> : null}
    >
      {editing ? (
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            action.run(() => saveLetterAction({ title, content }), () => setEditing(false));
          }}
        >
          <TextField
            id="letter-title"
            label="Titre"
            value={title}
            onChange={setTitle}
            max={PLAN_TEXT_LIMITS.letterTitle}
            placeholder={DEFAULT_LETTER_TITLE}
            hint="Facultatif."
          />
          <TextAreaField id="letter-content" label="Ma lettre" value={content} onChange={setContent} max={PLAN_TEXT_LIMITS.letter} rows={8} />
          <StatusLine error={action.error} saved={false} />
          <FormActions
            pending={action.isPending}
            dirty={dirty}
            retry={Boolean(action.error)}
            onCancel={() => {
              setTitle(letter?.title ?? "");
              setContent(letter?.content ?? "");
              setEditing(false);
              action.clearError();
            }}
          />
        </form>
      ) : letter ? (
        <>
          <details className="rounded-xl border">
            <summary className="flex min-h-12 cursor-pointer items-center px-4 font-medium">
              {letter.title || DEFAULT_LETTER_TITLE}
            </summary>
            <p className="px-4 pb-4 text-pretty whitespace-pre-line">{letter.content}</p>
          </details>
          <div>
            <ConfirmedActionButton
              label="Supprimer"
              accessibleLabel="Supprimer ma lettre"
              title="Supprimer ta lettre ?"
              description="Elle sera définitivement effacée. Tu pourras en écrire une nouvelle à tout moment."
              confirmLabel="Supprimer"
              pending={action.isPending}
              onConfirm={() => {
                setTitle("");
                setContent("");
                action.run(() => deleteLetterAction());
              }}
            />
          </div>
        </>
      ) : (
        <EmptyState
          text="Quelques mots écrits dans un moment plus calme peuvent être précieux lors d'une journée difficile."
          action={<AddButton label="Écrire ma lettre" onClick={() => setEditing(true)} />}
        />
      )}
      {!editing ? <StatusLine error={action.error} saved={action.saved} /> : null}
    </PlanSection>
  );
}
