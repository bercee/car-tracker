import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

import { ApiError } from '../api';
import { useIsMounted } from '../useIsMounted';
import { StatusMessage } from './StatusMessage';

export interface PanelActions<R> {
  onEdit: (record: R) => void;
  onDelete: (record: R) => void;
  disabled: boolean;
}

export interface PanelProps<T, R extends { id: number }> {
  title: string;
  load: () => Promise<R[]>;
  submit: (value: T) => Promise<unknown>;
  update: (id: number, value: T) => Promise<unknown>;
  remove: (id: number) => Promise<void>;
  toFormValue: (record: R) => T;
  initial: () => T;
  validate: (value: T) => string | undefined;
  children: (value: T, setValue: (value: T) => void, disabled: boolean) => ReactNode;
  table: (records: R[], actions: PanelActions<R>) => ReactNode;
}

export function Panel<T, R extends { id: number }>({
  title,
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
    setPending(true);
    setError(undefined);
    setMessage(undefined);
    try {
      if (wasEditing) await update(editingId!, value);
      else await submit(value);
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
  const onDelete = async (record: R) => {
    if (!window.confirm(`Delete this ${title} record? This cannot be undone.`)) return;
    setPending(true);
    setError(undefined);
    setMessage(undefined);
    try {
      await remove(record.id);
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
