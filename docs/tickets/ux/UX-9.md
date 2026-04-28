---
id: UX-9
severity: BUG
area: Frontend/UX
status: Open
discovered: Playwright live session
---

# UX-9 · Build Playlist button obscured by fixed bottom nav on mobile when description expanded

**File:** `web/src/app-shell.ts` CSS, `web/src/modules/playlist/playlist-view.ts`

## Description

On mobile (390×844), with description field visible, the Build Playlist button sits at
`y=783–823` while the fixed bottom nav occupies approximately `y=790–844`. The button
is partially or fully behind the nav bar and cannot reliably be tapped.

The `padding-bottom` reserved for the bottom nav does not account for the additional
height when the description textarea is shown.

## Fix

Make Build Playlist button `position: sticky; bottom: calc(56px + env(safe-area-inset-bottom))`
so it always floats above the nav bar; or ensure scroll container bottom padding matches
nav bar height + button height.
