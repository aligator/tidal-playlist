---
id: UX-2
severity: MEDIUM
area: Frontend/UX
status: Closed
resolution: Superseded by A-9 — file is dead code, never rendered
---

# UX-2 · Raw `<input>` / `<select>` in MWC app

**File:** `web/src/components/playlist-settings.ts` L312–322

## Description

Native form elements instead of `md-filled-text-field` / `md-outlined-select`.
Inconsistent theming and missing Material Design polish.

## Resolution

`playlist-settings.ts` is **never imported or rendered** (confirmed via Playwright).
The live UI uses `playlist-view.ts` with proper MWC components.
Track deletion under **A-9**.
