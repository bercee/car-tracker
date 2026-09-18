export function StatusMessage({ message, error = false }: { message?: string | undefined; error?: boolean }) {
  return (
    <p className={error ? 'status error' : 'status'} aria-live="polite" role={error ? 'alert' : 'status'}>
      {message}
    </p>
  );
}
