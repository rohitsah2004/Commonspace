export const ENTRY_TYPES = ['command', 'output', 'finding', 'note'] as const;
export const SESSION_PHASES = ['recon', 'foothold', 'privesc', 'post', 'other'] as const;
export type EntryType = typeof ENTRY_TYPES[number];
export type SessionPhase = typeof SESSION_PHASES[number];
export type Session = { id: string; name: string; platform: string; difficulty: 'beginner' | 'intermediate' | 'advanced'; status: 'active' | 'done'; created_at: number; updated_at: number };
export type SessionEntry = { id: string; session_id: string; type: EntryType; phase: SessionPhase; content: string; created_at: number };
export const SESSION_ENTRY_LIMIT = 500;
export const SESSION_TEXT_LIMIT = 20000;
