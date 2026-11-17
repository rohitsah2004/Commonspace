export type SiteSettings = {
  title: string;
  tagline: string;
  heroTitle: string;
  heroText: string;
  featuredCollection: string;
  securityContact: string;
};

export const defaultSiteSettings: SiteSettings = {
  title: 'Commonplace',
  tagline: 'A LITTLE SPACE FOR BIG IDEAS',
  heroTitle: 'A home for your curiosity',
  heroText: 'Notes, essays, and discoveries. Written by Rohit, shared with you.',
  featuredCollection: '',
  securityContact: '',
};

export function validateSiteSettings(input: unknown): SiteSettings {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Invalid site settings.');
  const value = input as Record<string, unknown>;
  const limits: Record<keyof SiteSettings, number> = {
    title: 80, tagline: 160, heroTitle: 160, heroText: 500,
    featuredCollection: 100, securityContact: 2048,
  };
  const result = { ...defaultSiteSettings };
  for (const key of Object.keys(limits) as (keyof SiteSettings)[]) {
    if (value[key] === undefined) continue;
    if (typeof value[key] !== 'string' || (value[key] as string).length > limits[key]) {
      throw Error(`Invalid ${key}.`);
    }
    result[key] = (value[key] as string).trim();
  }
  if (!result.title || !result.heroTitle) throw Error('Site title and hero title are required.');
  if (result.featuredCollection && !/^[a-zA-Z0-9-]+$/.test(result.featuredCollection)) {
    throw Error('Choose a valid featured collection.');
  }
  if (result.securityContact) {
    const email = /^(?:mailto:)?[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.securityContact);
    let web = false;
    try { const u = new URL(result.securityContact); web = u.protocol === 'https:' && !u.username && !u.password; } catch { /* email */ }
    if (!email && !web) throw Error('Security contact must be an email address or HTTPS URL.');
  }
  return result;
}
