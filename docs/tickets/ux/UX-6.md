---
id: UX-6
severity: LOW
area: Frontend/UX
status: Open
---

# UX-6 · Dead `css` part selector in `ui-search-sheet.ts`

**File:** `web/src/components/ui-search-sheet.ts`

## Description

`ui-bottom-sheet::part(sheet)` targets a non-existent part — rule silently ignored.

## Fix

Remove the stale rule.
