import { useCallback, useEffect, useRef } from 'react';

// Calls `reload` when a change the component did not start itself lands (`pending` goes true to false),
// for example one started before a remount. Returns what the component calls when it starts a change,
// since it refreshes for itself after its own.
export function useForeignChange(pending: boolean, reload: () => void) {
  const startedHere = useRef(false);
  const wasPending = useRef(pending);
  const latestReload = useRef(reload);
  useEffect(() => {
    latestReload.current = reload;
  });
  useEffect(() => {
    const landed = wasPending.current && !pending;
    wasPending.current = pending;
    if (!landed) return;
    if (startedHere.current) startedHere.current = false;
    else latestReload.current();
  }, [pending]);
  return useCallback((started: boolean) => {
    startedHere.current = started;
  }, []);
}
