'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
const Ownership = createContext(false);
export function OwnershipProvider({ children }: { children: ReactNode }) {
  const [owner, setOwner] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/me', { cache: 'no-store', signal: controller.signal }).then(r => r.json())
      .then(value => { if (!controller.signal.aborted) setOwner((value as { owner: boolean }).owner === true); }).catch(() => {});
    return () => controller.abort();
  }, []);
  return <Ownership.Provider value={owner}>{children}</Ownership.Provider>;
}
export const useOwner = () => useContext(Ownership);
