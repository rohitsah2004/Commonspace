# Security knowledge hub implementation log

This branch is repository-only. No deployment or production tests are authorized.
Existing migrations and generated scripts/vendor/UI source remain untouched.

## Phase 1 — content foundation

- Added strict optional content metadata, with missing type normalized to `post` and HTTPS-only resource URLs.
- Added typed public query/card helpers, tag slugs, related-item ranking, and the typecheck command.
- Preserved scheduled visibility and legacy document validation.
- Checks: `npx tsc --noEmit`, `npm run lint`, `npm run build`, and the loopback `python3 tests/integration.py` passed.
- Baseline lint: the initial repository had 108 lint errors. Existing dynamic-payload `any` annotations are recorded as warnings in an explicit legacy file allowlist; new modules remain strict. Standard anchors are intentional in Vinext/Sites, so Next's Link-only rule is disabled. The existing contenteditable DOM inspector is exempt from React Compiler's immutability inference (it intentionally edits DOM nodes). Fixed the render-time save-ref assignment and synchronous theme-state effect. Remaining legacy warnings are visible, not silently suppressed.
- Follow-up: later phases add editor controls and public type routes; no schema change was needed here.
