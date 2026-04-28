---
id: UX-4
severity: MEDIUM
area: Frontend/UX
status: Open
---

# UX-4 · No confirmation before destructive playlist save

**File:** `web/src/modules/tidal/api.ts` (caller sites)

## Description

Frontend calls `replacePlaylist` without user confirmation. Related to M-5 (backend
deletes all same-name playlists). User has no warning before data loss.

## Fix

Show confirmation dialog naming the playlist before save if it already exists.
