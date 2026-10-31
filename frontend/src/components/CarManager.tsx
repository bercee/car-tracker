import { useState, type FormEvent } from 'react';
import { carRequestSchema, type Car } from '@car-tracker/contracts';

import { addCar, ApiError, renameCar } from '../api';
import { parseRequest } from '../form';
import { useIsMounted } from '../useIsMounted';
import { StatusMessage } from './StatusMessage';

interface CarFormProps {
  legend: string;
  label: string;
  initialName: string;
  submitLabel: string;
  pendingLabel: string;
  successMessage: string;
  failureMessage: string;
  resetOnSuccess: boolean;
  save: (name: string) => Promise<void>;
}

function CarForm({
  legend,
  label,
  initialName,
  submitLabel,
  pendingLabel,
  successMessage,
  failureMessage,
  resetOnSuccess,
  save,
}: CarFormProps) {
  const [name, setName] = useState(initialName);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const isMounted = useIsMounted();
  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = parseRequest(carRequestSchema, { name });
    if ('error' in parsed) {
      setError(parsed.error);
      setMessage(undefined);
      return;
    }
    setPending(true);
    setError(undefined);
    setMessage(undefined);
    try {
      await save(parsed.data.name);
      if (!isMounted()) return;
      if (resetOnSuccess) setName('');
      setMessage(successMessage);
    } catch (cause) {
      if (isMounted()) setError(cause instanceof ApiError ? cause.message : failureMessage);
    } finally {
      if (isMounted()) setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <fieldset disabled={pending}>
        <legend>{legend}</legend>
        <label>
          {label}
          <input value={name} maxLength={60} required onChange={(event) => setName(event.target.value)} />
        </label>
        <button type="submit">{pending ? pendingLabel : submitLabel}</button>
      </fieldset>
      <StatusMessage message={error} error />
      <StatusMessage message={message} />
    </form>
  );
}

export interface CarManagerProps {
  activeCar: Car | undefined;
  onAdded: (car: Car) => void;
  onRenamed: (car: Car) => void;
}

export function CarManager({ activeCar, onAdded, onRenamed }: CarManagerProps) {
  return (
    <section aria-labelledby="cars-heading">
      <h2 id="cars-heading">Cars</h2>
      <CarForm
        legend="Add car"
        label="Name"
        initialName=""
        submitLabel="Add car"
        pendingLabel="Adding…"
        successMessage="Car added."
        failureMessage="Unable to add the car."
        resetOnSuccess
        save={async (name) => onAdded(await addCar({ name }))}
      />
      {activeCar !== undefined && (
        <CarForm
          key={activeCar.id}
          legend="Rename car"
          label="New name"
          initialName={activeCar.name}
          submitLabel="Rename car"
          pendingLabel="Renaming…"
          successMessage="Car renamed."
          failureMessage="Unable to rename the car."
          resetOnSuccess={false}
          save={async (name) => onRenamed(await renameCar(activeCar.id, { name }))}
        />
      )}
    </section>
  );
}
