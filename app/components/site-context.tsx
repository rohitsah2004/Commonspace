'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { defaultSiteSettings, type SiteSettings } from '../../lib/site-settings';

const SiteContext = createContext({ settings: defaultSiteSettings, origin: '' });
export function SiteProvider({ settings, origin, children }: {
  settings: SiteSettings; origin: string; children: ReactNode;
}) {
  return <SiteContext.Provider value={{ settings, origin }}>{children}</SiteContext.Provider>;
}
export const useSite = () => useContext(SiteContext);
