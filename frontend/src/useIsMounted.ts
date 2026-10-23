import { useCallback, useEffect, useRef } from 'react';

// True until the component unmounts, so late responses never update a component that has unmounted.
export function useIsMounted() {
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  return useCallback(() => mountedRef.current, []);
}
