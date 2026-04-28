---
id: UX-3
severity: LOW
area: Frontend/UX
status: Open
---

# UX-3 · `impressum-modal.ts` uses native `<dialog>` instead of `md-dialog`

**File:** `web/src/components/impressum-modal.ts` L140–173

## Description

Everything else uses MWC dialog. Native `<dialog>` breaks theming consistency.

## Fix

Migrate to `md-dialog`. Also wire it into `playlist-view.ts` (see A-15). Do **not** delete.
