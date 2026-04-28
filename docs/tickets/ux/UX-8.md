---
id: UX-8
severity: BUG
area: Frontend/UX
status: Done
discovered: Playwright live session
---

# UX-8 · Mobile bottom nav tabs missing icons

**File:** `web/src/app-shell.ts` L231–238

## Description

`NAV_TABS` defines an `icon` field used correctly in the desktop side-nav. For the
mobile `md-navigation-bar`, the template renders:

```html
<md-navigation-tab .label="${tab.label}" .active="${view === tab.view}"></md-navigation-tab>
```

No `active-icon` or `inactive-icon` slot provided. Tabs show labels only; active
indicator pill renders without an icon above the label.

## Fix

```html
<md-navigation-tab .label="${tab.label}" .active="${view === tab.view}">
  <md-icon slot="active-icon">${tab.icon}</md-icon>
  <md-icon slot="inactive-icon">${tab.icon}</md-icon>
</md-navigation-tab>
```
