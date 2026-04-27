# REDESIGN

## Goals

- Login lives on its own page, not embedded in the app shell
- Mobile-first, touch-compatible (44 px min targets, swipe gestures)
- Status feedback via snackbars + button loading states — no log panel
- Clean visual language: no nested boxes, typography-led, fluid sections
- Components = dumb UI primitives; modules = domain logic + domain views
- Use `@material/web` (MWC) throughout; theme via MWC token system

---

## Theming

Override MWC's `--md-sys-color-*` tokens directly on `:root` — **not inside `@layer`**
(CSS custom properties inherit into MWC shadow roots; `@layer` ordering does not).
Source color: TIDAL teal. Generate full token set via Material Theme Builder.

```css
/* DO — tokens directly on :root */
:root {
  color-scheme: light dark;
  --md-sys-color-primary:      light-dark(#00a0d6, #1ac8ff);
  --md-sys-color-background:   light-dark(#f5f6f8, #0f1117);
  --md-sys-color-surface:      light-dark(#ffffff, #1a1d27);
  /* ~30 tokens total from Material Theme Builder export */
}

/* @layer for layout/component rules only, not tokens */
@layer base, components, overrides;
```

Dark mode automatic via `prefers-color-scheme` + `light-dark()`. All MWC components
and custom `ui-*` components use the same token set.

---

## Component Catalog

### Use MWC directly (no wrapper)

| Need | MWC component |
|------|---------------|
| Buttons | `<md-filled-button>`, `<md-outlined-button>`, `<md-text-button>` |
| Text fields | `<md-filled-text-field>`, `<md-outlined-text-field>` |
| Chips | `<md-chip-set>` + `<md-input-chip>`, `<md-filter-chip>` |
| Slider | `<md-slider>` |
| Switch | `<md-switch>` |
| Dialog | `<md-dialog>` |
| Progress | `<md-linear-progress>`, `<md-circular-progress>` |
| Select | `<md-outlined-select>` + `<md-select-option>` |
| Tabs | `<md-tabs>` + `<md-primary-tab>` |
| List | `<md-list>` + `<md-list-item>` |
| Bottom nav | `<md-navigation-bar>` + `<md-navigation-tab>` |
| FAB | `<md-fab>` |
| Icons | `<md-icon>` |

`<md-navigation-bar>` has no built-in responsive breakpoint. Swap to side rail at
≥ 768 px via explicit `@media` query + `matchMedia` JS listener in `app-shell`.

### Custom (hand-rolled with MWC tokens)

| Component | Responsibility |
|-----------|----------------|
| `<ui-snackbar>` | Queue-based toast. `show(msg, type, duration?)`. Auto-dismiss success 3 s, persist error with retry action. Queue: show next after dismiss, drop duplicates. |
| `<ui-bottom-sheet>` | Slot-based slide-up overlay. `open` prop. Swipe-to-dismiss. |
| `<ui-top-bar>` | App bar. Title + trailing slot. Optional `back` button. |
| `<ui-search-sheet>` | Bottom sheet + debounced search input + results slot. Domain-agnostic. Used by library module; reusable for other modules. |

---

## UX Design

### Navigation

**Mobile:** `<md-navigation-bar>` fixed at bottom — 3 tabs: **Playlist · Library · Settings**
(consistent noun register; "Playlist" replaces "Build")
**Desktop (≥ 768 px):** persistent side rail, same destinations
Top: `<ui-top-bar>` with title + overflow menu (logout, impressum)

### Feedback model

| Trigger | Feedback |
|---------|----------|
| Build running | `<md-linear-progress>` under top bar + button stays in spinner state for full duration |
| Build success | Progress clears, result view pushed |
| Build error / 0 tracks | Snackbar with reason + retry; empty result state in result view |
| Save success | Snackbar auto-dismiss 3 s |
| Save error | Save button enters error state with inline retry (not just snackbar) |
| Remove/block action | Snackbar with "Undo" action, 5 s window |
| Network error | Distinct message ("Can't reach TIDAL. Check connection.") |
| Settings import | Confirmation dialog before overwrite |
| Empty pool on build attempt | Build button disabled + inline hint "Add sources in Library" |

Snackbar queue: one visible at a time; on simultaneous errors, queue second — show after dismiss.
Top-level `window.addEventListener('unhandledrejection')` feeds snackbar queue as fallback.

### Touch

- All targets ≥ 44 × 44 px
- Swipe down to dismiss bottom sheets
- No hover-only interactions

---

## App Screens

### 1. Login Page

Full-screen, vertically centered, no card wrapper.

```
┌─────────────────────────┐
│                         │
│    [TIDAL Playlist]     │
│    subtitle tagline     │
│                         │
│  [  Connect TIDAL  ]    │  ← md-filled-button, full width
│                         │
└─────────────────────────┘
```

- Single action. Button → spinner + "Connecting…" after tap.
- On TIDAL redirect return: full-screen loading state while `finishLogin()` runs.
- Error → snackbar "Could not connect. Try again."
- On success → auth signal transitions → shell pushes 'playlist' view.

### 2. Playlist View (main Build screen)

Layout order: Pool (what) → Settings (how) → Name (what to call it) → Action.
This matches natural mental model.

```
┌─────────────────────────┐
│ Tidal Playlist    [≡]   │  ← ui-top-bar
├─ linear progress ───────┤  ← md-linear-progress, hidden when idle
│                         │
│  Pool ──────────────    │
│  [☑ Liked artists]      │  ← md-filter-chip (toggle)
│  [☑ Liked albums ]      │
│  5 artists · 2 albums   │  ← reactive to active toggles only
│  [ Manage Library → ]   │  ← md-text-button, navigates to Library tab
│                         │
│  Country  [DE ▾]        │  ← md-outlined-select
│  Tracks   [30 ▾]        │
│  More artists ──○── More albums  │  ← md-slider with axis labels
│  Shuffle   ○──          │  ← md-switch
│                         │
│  [ Playlist Name  ]     │  ← md-filled-text-field
│  + Add description      │  ← md-text-button, expands inline field
│                         │
│  [  Build Playlist  ]   │  ← disabled when no pool sources active
│                         │     shows inline hint if tapped while disabled
└─────────────────────────┘
│ Playlist│ Library │ ⚙   │  ← md-navigation-bar
└─────────────────────────┘
```

Pool count line is reactive: reflects only what active toggles + manual library contribute,
not total library size.

Empty pool state (no liked toggles, no manual items):
```
  Pool ──────────────────
  [  Liked artists  ]  [  Liked albums  ]   ← both off
  Add sources in Library to build a playlist.
  [ Go to Library → ]
```

**Description expand:**
```
[ Playlist Name _________ ]
+ Add description           ← tap to expand

↓ expanded:
[ Playlist Name _________ ]
[ Description ____________]
[ _______________________ ]
```

### 3. Result View (pushed from Playlist view)

```
┌─────────────────────────┐
│ ←  Result               │  ← ui-top-bar with back button
├─────────────────────────┤
│  28 tracks              │
│                         │
│  [md-list]              │
│   Song · Artist    [⋮]  │  ← trailing icon-button: "Block artist / Block album"
│   Song · Artist    [⋮]  │    snackbar confirms: "Added to Blocked in Library"
│   ...                   │    + Undo action
│                         │
│  [ Save to TIDAL ]      │  ← primary action; enters error+retry state on failure
│                         │
│  ── 0 tracks empty ──   │  ← empty state: "No tracks found. Try adding more sources
│                         │    or adjusting settings." + back button
└─────────────────────────┘
```

Back → returns to Playlist view preserving build state for retry.

### 4. Library View

```
┌─────────────────────────┐
│ Library             [+] │  ← [+] opens ui-search-sheet
├─────────────────────────┤
│ [Artists|Albums|Blocked]│  ← md-tabs
│                         │
│  md-list of items       │
│   Artist A        [×]   │  ← remove → snackbar with Undo
│   Artist B        [×]   │
│                         │
│  (empty state per tab)  │
└─────────────────────────┘
│ Playlist│ Library │ ⚙   │
└─────────────────────────┘
```

"Blocked" tab (renamed from "Blacklist"). Shows blocked artists + albums, unblock action.
`<ui-search-sheet>` context: search TIDAL, pick artist or album, confirm add.

### 5. Settings View

```
┌─────────────────────────┐
│ Settings                │
├─────────────────────────┤
│  Export config   [↑]    │
│  Import config   [↓]    │  ← confirmation dialog before overwrite
│ ─────────────────────── │
│  Account                │
│  user@…        [Logout] │
│ ─────────────────────── │
│  Impressum       [→]    │
└─────────────────────────┘
│ Playlist│ Library │ ⚙   │
└─────────────────────────┘
```

---

## Code Architecture

### Principle

```
web/src/
├── components/       # ui-* — dumb primitives, no domain terms, no API calls
└── modules/          # domain = logic + reactive state + domain views
    ├── auth/
    ├── playlist/
    ├── library/
    └── settings/
```

Components know nothing about TIDAL, playlists, or auth.
Modules: `store.ts` (signals + business logic), `*-view.ts` (Lit page), optional `api.ts`.

### Module Structure

```
modules/
├── auth/
│   ├── store.ts          # authentication = signal<TidalAuth | null>(null)
│   │                     # isAuthenticated = computed(() => authentication.get() !== null)
│   │                     # login(), logout() actions
│   ├── login-page.ts     # <login-page> — handles initial tap + OAuth callback return state
│   ├── auth-guard.ts     # reads isAuthenticated in render(); redirects to login view
│   └── api.ts            # startLogin(), finishLogin() — sets authentication signal on success
│
├── playlist/
│   ├── store.ts          # buildStatus, result, settings signals; buildPlaylist(), savePlaylist()
│   ├── playlist-view.ts  # <playlist-view>
│   ├── result-view.ts    # <result-view>
│   └── builder.ts        # PlaylistBuilder (pure algorithm, no signals)
│
├── library/
│   ├── store.ts          # artists, albums, blocked as signals (string[] — not newline strings)
│   │                     # add/remove actions use signal.set([...signal.get(), item]) — no mutation
│   ├── library-view.ts   # <library-view> with md-tabs
│   └── search-sheet.ts   # composes <ui-search-sheet> with TIDAL search logic
│
└── settings/
    ├── store.ts          # AppSettings signal; persist via Signal.subtle.Watch → saveSettings()
    ├── settings-view.ts  # <settings-view>
    └── persistence.ts    # loadSettings(), saveSettings()
```

### State (Lit Signals)

No `applyToUi()` / `readFromUi()`. Views consume signals via `SignalWatcher` mixin.
Signal reads must occur inside `render()` or `computed()` consumed in `render()` — reads
in `connectedCallback`, `updated()`, or async callbacks are not tracked.

```ts
// modules/auth/store.ts
export const authentication  = signal<TidalAuth | null>(null);
export const isAuthenticated = computed(() => authentication.get() !== null);
// isAuthenticated guards all actions; prevents concurrent auth write races

// modules/playlist/store.ts
export const buildStatus = signal<'idle' | 'building' | 'done' | 'error'>('idle');
export const result      = signal<SelectedSong[]>([]);
export const settings    = signal<AppSettings>(defaultSettings);
```

**Persistence side-effect** (`@lit-labs/signals` has no built-in `effect()`):
```ts
// settings/store.ts — use Signal.subtle.Watch for persistence
const watcher = new Signal.subtle.Watch(() => {
  saveSettings(settings.get());
});
watcher.watch(settings);
// Call watcher.getPending() in a microtask to flush
```

**Array signals — never mutate in place:**
```ts
// Wrong — no update triggered
artists.get().push(newArtist);

// Correct
artists.set([...artists.get(), newArtist]);
```

**Token expiry:** if `TidalAuth` token expires mid-session, set `authentication` to `null`
to trigger re-login flow. Token refresh responsibility belongs to `TidalAuth` SDK; on
failure, catch and nullify the signal.

### Routing

View stack signal — not a flat enum (result view needs push/pop, not just switch):

```ts
// app-shell.ts
export const viewStack = signal<string[]>(['playlist']);
export const currentView = computed(() => {
  const stack = viewStack.get();
  return stack[stack.length - 1];
});
export function pushView(view: string) {
  viewStack.set([...viewStack.get(), view]);
}
export function popView() {
  const stack = viewStack.get();
  if (stack.length > 1) viewStack.set(stack.slice(0, -1));
}
```

Auth guard: when `isAuthenticated` is false, `pushView('login')`.
OAuth callback return: `finishLogin()` sets `authentication` signal → shell reacts via
`computed` → pops 'login', pushes 'playlist'.

---

## Migration Order

1. CSS tokens — generate MWC theme from TIDAL teal, wire `light-dark()` dark mode (tokens on `:root`, not in `@layer`)
2. `app-shell` skeleton — signal router (viewStack), nav-bar, responsive breakpoint logic; renders placeholder per view
3. `ui-snackbar`, `ui-bottom-sheet`, `ui-top-bar`, `ui-search-sheet` — 4 custom primitives
4. `auth` module — store (signal + isAuthenticated computed), login-page (incl. callback loading state), auth-guard
5. `settings` module — signal store with `Signal.subtle.Watch` persistence, settings-view, import confirmation dialog
6. `library` module — store (string[] signals), library-view, search-sheet (composes ui-search-sheet)
7. `playlist` module — store + playlist-view (pool reactive count, disabled build button) + result-view (empty state, inline save retry)
8. Wire app-shell — connect all views, error boundary (`unhandledrejection` → snackbar)
9. Delete: `main-element.ts`, `log-panel.ts`, `auth-store.ts`, `styled-element.ts`

Each step independently testable against the skeleton shell from step 2.
Backend untouched throughout.

---

## TODO

> **Rule: one task at a time. Never start the next until the current is done, committed, and building without errors.**

### Step 1 — CSS Tokens
- [x] Run Material Theme Builder with TIDAL teal (`#00a0d6`) as source color; export light + dark token sets
- [x] Replace `web/src/index.css` with MWC token declarations directly on `:root` (no `@layer` for tokens)
- [x] Wire `light-dark()` for all `--md-sys-color-*` tokens
- [x] Add `@layer base, components, overrides` for non-token rules
- [x] Verify build + manual dark mode check

### Step 2 — App Shell Skeleton
- [x] Create `web/src/app-shell.ts` — `<app-shell>` Lit element
- [x] Implement `viewStack`, `currentView`, `pushView()`, `popView()` signal router
- [x] Add `<md-navigation-bar>` + `<md-navigation-tab>` (Playlist · Library · Settings)
- [x] Add `@media` + `matchMedia` responsive swap to side rail at ≥ 768 px
- [x] Render placeholder `<div>` per view slot (no real views yet)
- [x] Wire `index.ts` to mount `<app-shell>` instead of `<main-element>`
- [x] Verify build + manual nav between placeholder views

### Step 3 — Custom Primitives
- [x] `<ui-top-bar>` — title, trailing slot, optional back button
- [x] `<ui-bottom-sheet>` — slot-based, `open` prop, swipe-to-dismiss
- [x] `<ui-snackbar>` — queue, auto-dismiss success (3 s), persist error, Undo action support, max 1 visible
- [x] `<ui-search-sheet>` — composes `<ui-bottom-sheet>` + debounced search input + results slot; domain-agnostic
- [x] Register all in `index.ts`
- [x] Verify build

### Step 4 — Auth Module
- [x] `modules/auth/store.ts` — `authentication` signal, `isAuthenticated` computed, `login()`, `logout()`
- [x] `modules/auth/api.ts` — `startLogin()`, `finishLogin()` (already exists — migrate + wire to signal)
- [x] `modules/auth/login-page.ts` — `<login-page>`: connect button, spinner state, OAuth callback return loading state, error snackbar
- [x] `modules/auth/auth-guard.ts` — reads `isAuthenticated` in `render()`; pushes 'login' view when false
- [x] Wire auth-guard into app-shell
- [ ] Verify full OAuth login flow end-to-end

### Step 5 — Settings Module
- [x] `modules/settings/persistence.ts` — `loadSettings()`, `saveSettings()` (migrate from existing)
- [x] `modules/settings/store.ts` — `AppSettings` signal, `Signal.subtle.Watch` for debounced persistence, `importSettings()` with validation
- [x] `modules/settings/settings-view.ts` — `<settings-view>`: export, import (with `<md-dialog>` confirmation), logout, impressum link
- [x] Wire settings-view into app-shell
- [x] Verify settings persist across reload

### Step 6 — Library Module
- [x] `modules/library/store.ts` — `artists`, `albums`, `blocked` as `signal<string[]>`, add/remove actions (immutable set pattern)
- [x] `modules/library/search-sheet.ts` — `<library-search-sheet>`: composes `<ui-search-sheet>`, calls TIDAL search, emits selected item
- [x] `modules/library/library-view.ts` — `<library-view>`: `<md-tabs>` (Artists · Albums · Blocked), `<md-list>` per tab, remove with Undo snackbar, `[+]` opens search sheet, empty states per tab
- [x] Wire library-view into app-shell
- [ ] Verify add/remove/block flows

### Step 7 — Playlist Module
- [x] `modules/playlist/builder.ts` — migrate `PlaylistBuilder` (pure algorithm, no signals)
- [x] `modules/playlist/store.ts` — `buildStatus`, `result`, `settings` signals; `buildPlaylist()`, `savePlaylist()`; pool count computed from library signals + liked toggles
- [x] `modules/playlist/result-view.ts` — `<result-view>`: track list with block action (snackbar "Added to Blocked" + Undo), Save button with inline error+retry, empty state (0 tracks)
- [x] `modules/playlist/playlist-view.ts` — `<playlist-view>`: pool section (liked toggles + reactive count + "Manage Library →"), settings fields (slider with axis labels), name/description (expandable), Build button (disabled when no sources, spinner during build), linear progress bar
- [x] Wire playlist-view + result-view into app-shell (`pushView('result')` after build)
- [ ] Verify full build → result → save → back flow

### Step 8 — Wire & Harden
- [x] Connect all modules in app-shell (replace placeholders)
- [x] Add `window.addEventListener('unhandledrejection')` → snackbar error boundary
- [x] Token expiry: catch `TidalAuth` failures → set `authentication` to `null` → re-login
- [x] Verify responsive layout (mobile + desktop breakpoint)
- [x] Run `deno task check` — zero errors
- [x] Run `deno task build` — zero errors

### Step 9 — Cleanup
- [x] Delete `web/src/main-element.ts`
- [x] Delete `web/src/components/log-panel.ts`
- [x] Delete `web/src/modules/auth/auth-store.ts` (dead stub)
- [ ] Delete `web/src/styled-element.ts` (kept: still imported by app-toolbar, list-manager, playlist-settings, impressum-modal, selected-songs-panel)
- [x] Remove any dead imports from `index.ts`
- [x] Final `deno task check` + `deno task build`
