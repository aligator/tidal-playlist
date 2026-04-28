---
id: UX-1
severity: BUG
area: Frontend/UX
status: Open
---

# UX-1 · Progress bar stuck — never shows during playlist build

**File:** `web/src/modules/playlist/playlist-view.ts` L172–176

## Description

`value` hardcoded to `0` in both `isBuilding` branches. `md-linear-progress` never
shows visual feedback during build. User sees status text only.

## Fix

Use `[hidden]="${!isBuilding}"` or proper opacity/value binding to reflect actual progress.
