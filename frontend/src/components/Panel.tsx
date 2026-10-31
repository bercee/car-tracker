import { useEffect, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';

import { ApiError } from '../api';
import { useForeignChange } from '../useForeignChange';
import { useIsMounted } from '../useIsMounted';
import type { RecordAction, UndoHistory } from '../undoHistory';
import { StatusMessage } from './StatusMessage';

const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

// What Undo and Redo each read from and do to the Undo history, and their status wording.
const verbs = {
  Undo: {
    done: 'Undid',
    next: (undoHistory: UndoHistory) => undoHistory.nextUndo(),
    apply: (undoHistory: UndoHistory, discard: (cause: unknown) => boolean) => undoHistory.undo(discard),
  },
  Redo: {
    done: 'Redid',
    next: (undoHistory: UndoHistory) => undoHistory.nextRedo(),
    apply: (undoHistory: UndoHistory, discard: (cause: unknown) => boolean) => undoHistory.redo(discard),
  },
};
type Verb = keyof typeof verbs;

const describe = (action: RecordAction) => `${action.label} from ${action.eventDate}`;

/** The props every Record type's Panel takes from the App. */
export interface RecordPanelProps {
  carId: number;
  undoHistory: UndoHistory;
  /** Whether this Panel's Section is the one on screen; only then do the shortcuts act. */
  visible: boolean;
}

export interface PanelActions<R> {
  onEdit: (record: R) => void;
  onDelete: (record: R) => void;
  disabled: boolean;
}

export interface PanelProps<T extends { eventDate: string }, R extends { id: number }> {
  title: string;
  undoHistory: UndoHistory;
  visible: boolean;
  load: () => Promise<R[]>;
  submit: (value: T) => Promise<R>;
  update: (id: number, value: T) => Promise<unknown>;
  remove: (id: number) => Promise<void>;
  toFormValue: (record: R) => T;
  initial: () => T;
  validate: (value: T) => string | undefined;
  children: (value: T, setValue: (value: T) => void, disabled: boolean) => ReactNode;
  table: (records: R[], actions: PanelActions<R>) => ReactNode;
}

export function Panel<T extends { eventDate: string }, R extends { id: number }>({
  title,
  undoHistory,
  visible,
  load,
  submit,
  update,
  remove,
  toFormValue,
  initial,
  validate,
  children,
  table,
}: PanelProps<T, R>) {
  const [value, setValue] = useState(initial);
  const [records, setRecords] = useState<R[]>([]);
  const [loading, setLoading] = useState(true);
  // The Record being edited, with its values as loaded into the form, so the edit can be undone.
  const [editing, setEditing] = useState<{ id: number; before: T }>();
  const editingId = editing?.id;
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const isMounted = useIsMounted();
  // The Undo history outlives this Panel, so a change started before a remount still disables the controls here.
  useSyncExternalStore(undoHistory.subscribe, undoHistory.snapshot);
  const pending = undoHistory.pending;
  // Whether this Panel's own save, update, delete, undo or redo is in flight, as opposed to one started before a remount.
  const [saving, setSaving] = useState(false);
  const refresh = async () => {
    setLoading(true);
    try {
      const loaded = await load();
      if (isMounted()) setRecords(loaded);
    } catch (cause) {
      if (isMounted()) setError(cause instanceof Error ? cause.message : 'Unable to load records.');
    } finally {
      if (isMounted()) setLoading(false);
    }
  };
  useEffect(() => {
    let cancelled = false;
    void load()
      .then((loaded) => {
        if (!cancelled) setRecords(loaded);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Unable to load records.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  // A change started before a remount lands without this Panel's handlers, so the list is reloaded here.
  const markStarted = useForeignChange(pending, () => void refresh());

  const label = (kind: 'add' | 'edit' | 'delete') => `${kind} of ${title} record`;
  const addAction = (id: number, after: T): RecordAction => ({
    recordId: id,
    label: label('add'),
    eventDate: after.eventDate,
    reverse: (current) => remove(current),
    reapply: async () => (await submit(after)).id,
  });
  const editAction = (id: number, before: T, after: T): RecordAction => ({
    recordId: id,
    label: label('edit'),
    eventDate: before.eventDate,
    reverse: async (current) => void (await update(current, before)),
    reapply: async (current) => void (await update(current, after)),
  });
  const deleteAction = (id: number, before: T): RecordAction => ({
    recordId: id,
    label: label('delete'),
    eventDate: before.eventDate,
    reverse: async () => (await submit(before)).id,
    reapply: (current) => remove(current),
  });

  const onEdit = (record: R) => {
    const before = toFormValue(record);
    setEditing({ id: record.id, before });
    setValue(before);
    setError(undefined);
    setMessage(undefined);
  };
  const cancelEdit = () => {
    setEditing(undefined);
    setValue(initial());
    setError(undefined);
    setMessage(undefined);
  };
  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const invalid = validate(value);
    if (invalid) {
      setError(invalid);
      return;
    }
    const wasEditing = editing !== undefined;
    setError(undefined);
    setMessage(undefined);
    markStarted(true);
    setSaving(true);
    try {
      const after = value;
      await undoHistory.run(async () => {
        if (editing) {
          await update(editing.id, after);
          undoHistory.record(editAction(editing.id, editing.before, after));
        } else {
          const created = await submit(after);
          undoHistory.record(addAction(created.id, after));
        }
      });
      if (!isMounted()) return;
      setValue(initial());
      setEditing(undefined);
      setMessage(`${title} record ${wasEditing ? 'updated' : 'saved'}.`);
      await refresh();
    } catch (cause) {
      if (isMounted()) {
        setError(cause instanceof ApiError ? cause.message : `Unable to ${wasEditing ? 'update' : 'save'} the record.`);
      }
    } finally {
      if (isMounted()) setSaving(false);
    }
  };
  const applyUndoRedo = async (verb: Verb) => {
    const what = verbs[verb].next(undoHistory)?.label;
    setError(undefined);
    setMessage(undefined);
    markStarted(!undoHistory.pending && what !== undefined);
    try {
      // A network failure keeps the Record action for a retry; any other API failure drops it.
      const discard = (cause: unknown) => cause instanceof ApiError && cause.kind !== 'network';
      const action = await verbs[verb].apply(undoHistory, discard);
      if (!isMounted() || !action) return;
      if (editingId === action.recordId) {
        setEditing(undefined);
        setValue(initial());
      }
      setMessage(`${verbs[verb].done} ${action.label}.`);
      await refresh();
    } catch (cause) {
      if (isMounted()) {
        setError(
          cause instanceof ApiError ? cause.message : `Unable to ${verb.toLowerCase()} ${what ?? 'the action'}.`,
        );
      }
    }
  };
  const handleShortcut = (verb: Verb) => {
    if (undoHistory.pending || verbs[verb].next(undoHistory) === undefined) return false;
    void applyUndoRedo(verb);
    return true;
  };
  // Re-subscribes after every render so the listener sees the latest Undo history and pending state.
  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      const verb: Verb | undefined =
        key === 'z' && !event.shiftKey ? 'Undo' : key === 'y' || (key === 'z' && event.shiftKey) ? 'Redo' : undefined;
      if (!verb || isEditable(event.target)) return;
      if (handleShortcut(verb)) event.preventDefault();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  });
  const onDelete = async (record: R) => {
    setError(undefined);
    setMessage(undefined);
    markStarted(true);
    try {
      await undoHistory.run(async () => {
        await remove(record.id);
        undoHistory.record(deleteAction(record.id, toFormValue(record)));
      });
      if (!isMounted()) return;
      if (editingId === record.id) {
        setEditing(undefined);
        setValue(initial());
      }
      setMessage(`${title} record deleted.`);
      await refresh();
    } catch (cause) {
      if (isMounted()) setError(cause instanceof ApiError ? cause.message : 'Unable to delete the record.');
    }
  };

  return (
    <section aria-labelledby={`${title}-heading`}>
      <h2 id={`${title}-heading`}>{title}</h2>
      <form onSubmit={onSubmit}>
        <fieldset disabled={pending}>
          <legend>
            {editingId === undefined ? `Add ${title.toLowerCase()} record` : `Edit ${title.toLowerCase()} record`}
          </legend>
          {children(value, setValue, pending)}
          <button type="submit">
            {saving
              ? editingId === undefined
                ? 'Saving…'
                : 'Updating…'
              : editingId === undefined
                ? 'Save record'
                : 'Update record'}
          </button>
          {editingId !== undefined && (
            <button type="button" onClick={cancelEdit}>
              Cancel edit
            </button>
          )}
        </fieldset>
      </form>
      <div className="undo-redo">
        {(Object.keys(verbs) as Verb[]).map((verb) => {
          const next = verbs[verb].next(undoHistory);
          return (
            <button
              key={verb}
              type="button"
              disabled={pending || next === undefined}
              aria-label={next === undefined ? verb : `${verb} ${describe(next)}`}
              onClick={() => void applyUndoRedo(verb)}
            >
              {verb}
            </button>
          );
        })}
      </div>
      <StatusMessage message={error} error />
      <StatusMessage message={message} />
      {loading ? (
        <p aria-live="polite">Loading records…</p>
      ) : error && records.length === 0 ? (
        <p>Could not load records.</p>
      ) : (
        table(records, { onEdit, onDelete, disabled: pending })
      )}
    </section>
  );
}
