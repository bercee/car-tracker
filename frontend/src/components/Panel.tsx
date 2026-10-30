import { useEffect, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';

import { ApiError } from '../api';
import { useIsMounted } from '../useIsMounted';
import type { UndoHistory } from '../undoHistory';
import { StatusMessage } from './StatusMessage';

const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

export interface PanelActions<R> {
  onEdit: (record: R) => void;
  onDelete: (record: R) => void;
  disabled: boolean;
}

export interface PanelProps<T extends { eventDate: string }, R extends { id: number }> {
  title: string;
  history: UndoHistory;
  /** Whether this Panel's Section is the one on screen; only then do the shortcuts act. */
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
  history,
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
  // The history outlives this Panel, so a change started before a remount still disables the controls here.
  useSyncExternalStore(history.subscribe, history.snapshot);
  const pending = history.pending;
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
    try {
      const after = value;
      await history.run(async () => {
        if (editing) {
          const { id, before } = editing;
          await update(id, after);
          history.record({
            recordId: id,
            description: `edit of ${title} record from ${before.eventDate}`,
            reverse: async (current) => void (await update(current, before)),
            reapply: async (current) => void (await update(current, after)),
          });
        } else {
          const created = await submit(after);
          history.record({
            recordId: created.id,
            description: `add of ${title} record from ${after.eventDate}`,
            reverse: async (id) => remove(id),
            reapply: async () => (await submit(after)).id,
          });
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
    }
  };
  const applyUndoRedo = async (verb: 'Undo' | 'Redo') => {
    const what = (verb === 'Undo' ? history.undoDescription() : history.redoDescription())?.replace(/ from .*$/, '');
    setError(undefined);
    setMessage(undefined);
    try {
      // A network failure keeps the entry for a retry; any other API failure drops it.
      const discard = (cause: unknown) => cause instanceof ApiError && cause.kind !== 'network';
      const entry = await (verb === 'Undo' ? history.undo(discard) : history.redo(discard));
      if (!isMounted() || !entry) return;
      if (editingId === entry.recordId) {
        setEditing(undefined);
        setValue(initial());
      }
      setMessage(`${verb === 'Undo' ? 'Undid' : 'Redid'} ${entry.description.replace(/ from .*$/, '')}.`);
      await refresh();
    } catch (cause) {
      if (isMounted()) {
        setError(
          cause instanceof ApiError ? cause.message : `Unable to ${verb.toLowerCase()} ${what ?? 'the action'}.`,
        );
      }
    }
  };
  const handleShortcut = (verb: 'Undo' | 'Redo') => {
    const description = verb === 'Undo' ? history.undoDescription() : history.redoDescription();
    if (history.pending || description === undefined) return false;
    void applyUndoRedo(verb);
    return true;
  };
  // Re-subscribes after every render so the listener sees the latest history and pending state.
  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      const verb =
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
    try {
      await history.run(async () => {
        await remove(record.id);
        const before = toFormValue(record);
        history.record({
          recordId: record.id,
          description: `delete of ${title} record from ${before.eventDate}`,
          reverse: async () => (await submit(before)).id,
          reapply: async (id) => remove(id),
        });
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
            {pending
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
        {(['Undo', 'Redo'] as const).map((verb) => {
          const description = verb === 'Undo' ? history.undoDescription() : history.redoDescription();
          return (
            <button
              key={verb}
              type="button"
              disabled={pending || description === undefined}
              aria-label={description === undefined ? verb : `${verb} ${description}`}
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
