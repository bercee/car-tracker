import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

import { ApiError } from '../api';
import { useIsMounted } from '../useIsMounted';
import type { UndoHistory } from '../undoHistory';
import { StatusMessage } from './StatusMessage';

export interface PanelActions<R> {
  onEdit: (record: R) => void;
  onDelete: (record: R) => void;
  disabled: boolean;
}

export interface PanelProps<T extends { eventDate: string }, R extends { id: number }> {
  title: string;
  history: UndoHistory;
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
  const [pending, setPending] = useState(false);
  const [editingId, setEditingId] = useState<number>();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const isMounted = useIsMounted();
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
    setEditingId(record.id);
    setValue(toFormValue(record));
    setError(undefined);
    setMessage(undefined);
  };
  const cancelEdit = () => {
    setEditingId(undefined);
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
    const wasEditing = editingId !== undefined;
    const previous = wasEditing ? records.find((record) => record.id === editingId) : undefined;
    setPending(true);
    setError(undefined);
    setMessage(undefined);
    try {
      let created: R | undefined;
      if (wasEditing) await update(editingId!, value);
      else created = await submit(value);
      if (created) {
        const after = value;
        history.record({
          recordId: created.id,
          description: `add of ${title} record from ${after.eventDate}`,
          reverse: async (id) => remove(id),
          reapply: async () => (await submit(after)).id,
        });
      }
      if (previous) {
        const id = previous.id;
        const before = toFormValue(previous);
        const after = value;
        history.record({
          recordId: id,
          description: `edit of ${title} record from ${before.eventDate}`,
          reverse: async (current) => void (await update(current, before)),
          reapply: async (current) => void (await update(current, after)),
        });
      }
      if (!isMounted()) return;
      setValue(initial());
      setEditingId(undefined);
      setMessage(`${title} record ${wasEditing ? 'updated' : 'saved'}.`);
      await refresh();
    } catch (cause) {
      if (isMounted()) {
        setError(cause instanceof ApiError ? cause.message : `Unable to ${wasEditing ? 'update' : 'save'} the record.`);
      }
    } finally {
      if (isMounted()) setPending(false);
    }
  };
  const applyUndoRedo = async (verb: 'Undo' | 'Redo') => {
    const what = (verb === 'Undo' ? history.undoDescription() : history.redoDescription())?.replace(/ from .*$/, '');
    setPending(true);
    setError(undefined);
    setMessage(undefined);
    try {
      // A network failure keeps the entry for a retry; any other API failure drops it.
      const discard = (cause: unknown) => cause instanceof ApiError && cause.kind !== 'network';
      const entry = await (verb === 'Undo' ? history.undo(discard) : history.redo(discard));
      if (!isMounted() || !entry) return;
      if (editingId === entry.recordId) {
        setEditingId(undefined);
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
    } finally {
      if (isMounted()) setPending(false);
    }
  };
  const onDelete = async (record: R) => {
    setPending(true);
    setError(undefined);
    setMessage(undefined);
    try {
      await remove(record.id);
      const before = toFormValue(record);
      history.record({
        recordId: record.id,
        description: `delete of ${title} record from ${before.eventDate}`,
        reverse: async () => (await submit(before)).id,
        reapply: async (id) => remove(id),
      });
      if (!isMounted()) return;
      if (editingId === record.id) {
        setEditingId(undefined);
        setValue(initial());
      }
      setMessage(`${title} record deleted.`);
      await refresh();
    } catch (cause) {
      if (isMounted()) setError(cause instanceof ApiError ? cause.message : 'Unable to delete the record.');
    } finally {
      if (isMounted()) setPending(false);
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
