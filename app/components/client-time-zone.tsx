'use client';
import { useSyncExternalStore } from 'react';
const subscribe = () => () => {};
const serverZone = () => 'UTC';
const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
/** Hydrate with the same UTC label as the server, then read the browser zone. */
export function ClientTimeZone() {
  return <span>{useSyncExternalStore(subscribe, browserZone, serverZone)}</span>;
}
