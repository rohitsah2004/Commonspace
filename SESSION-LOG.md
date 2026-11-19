# Session logs — PR 1: private capture

`/studio/sessions` is owner-only. Create a named session with platform, difficulty and active/done status. Entries are command, output, finding or note, with recon/foothold/privesc/post/other phases. Ctrl/Cmd+Enter appends without navigating; editing retains the original timestamp and exact text, including whitespace. Sessions and entries require explicit deletion confirmation. Session deletion cascades to entries.

The APIs use the existing owner/same-origin guards and authenticated user ID. Every data statement scopes by owner ID. Entry insertion enforces the 500 cap in one SQL statement; entry text is limited to 20,000 JS string characters. IDs/enums/lengths/fields and streaming request size are validated. Errors do not expose database details. GETs are no-store; session data is absent from public queries/feeds/search.

The generated `0004_keen_jigsaw.sql` migration adds only sessions/session_entries and their indexes. Old migrations are unchanged. Apply to local preview before testing; production has NOT been migrated or deployed.

Validation: TypeScript, build, lint and unit tests, including real SQLite migration/API checks for cross-owner isolation, byte-preserving text, validation, atomic caps and cascade deletion. Browser QA confirmed create, autofocus, Ctrl+Enter append and exact special-character rendering using a disposable local fixture. No AI calls in this PR. No deployment/merge is authorized yet.

PR 2 will add phase/range compilation, one-way target masking and the additive writeup-mode preview/Apply flow. It will be stacked on this branch. Public publishing remains a separate owner action.
