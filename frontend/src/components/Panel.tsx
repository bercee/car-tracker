import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

import { ApiError } from '../api';
import { StatusMessage } from './StatusMessage';

export interface PanelProps<T, R> {
  title: string;
  load: () => Promise<R[]>;
  submit: (value: T) => Promise<unknown>;
  initial: () => T;
  validate: (value: T) => string | undefined;
  children: (value: T, setValue: (value: T) => void, disabled: boolean) => ReactNode;
  table: (records: R[]) => ReactNode;
}

export function Panel<T, R>({ title, load, submit, initial, validate, children, table }: PanelProps<T, R>) {
  const [value, setValue] = useState(initial);
  const [records, setRecords] = useState<R[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const refresh = async () => {
    setLoading(true);
    setError(undefined);
    try {
      setRecords(await load());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load records.');
    } finally {
      setLoading(false);
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
  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const invalid = validate(value);
    if (invalid) {
      setError(invalid);
      return;
    }
    setPending(true);
    setError(undefined);
    setMessage(undefined);
    try {
      await submit(value);
      setValue(initial());
      setMessage(`${title} record saved.`);
      await refresh();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to save the record.');
    } finally {
      setPending(false);
    }
  };
  return (
    <section aria-labelledby={`${title}-heading`}>
      <h2 id={`${title}-heading`}>{title}</h2>
      <form onSubmit={onSubmit}>
        <fieldset disabled={pending}>
          <legend>Add {title.toLowerCase()} record</legend>
          {children(value, setValue, pending)}
          <button type="submit">{pending ? 'Saving…' : 'Save record'}</button>
        </fieldset>
      </form>
      <StatusMessage message={error} error />
      <StatusMessage message={message} />
      {loading ? (
        <p aria-live="polite">Loading records…</p>
      ) : error && records.length === 0 ? (
        <p>Could not load records.</p>
      ) : (
        table(records)
      )}
    </section>
  );
}
