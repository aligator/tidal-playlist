---
id: UX-7
severity: BUG
area: Frontend/UX
status: Done
discovered: Playwright live session
---

# UX-7 · `defaultCountryCodeFromBrowser()` extracts language subtag, not region

**File:** `web/src/modules/tidal/shared.ts` L99–131

## Description

Regex `/(?:^|[-_])([A-Za-z]{2})(?:$|[-_])/` matches the **first** 2-letter segment of
a BCP 47 locale tag. For `nb-NO` (Norwegian) it captures `NB` (language), not `NO`
(country/region). `NB` is not in `COUNTRY_CODES` → Country select is blank on first
load; user must scroll 20 options every session.

Affects: `nb-NO`, `zh-CN`, `zh-TW`, `pt-BR`, `fr-CA`, and any locale where language subtag ≠ region subtag.

Additionally: derived code is never validated against `COUNTRY_CODES`.

## Fix

```typescript
function defaultCountryCodeFromBrowser(): string {
  const fallback = 'US';
  for (const tag of (navigator.languages?.length ? navigator.languages : [navigator.language])) {
    try {
      const region = new Intl.Locale(tag).region?.toUpperCase();
      if (region && /^[A-Z]{2}$/.test(region)) return region;
    } catch { /* invalid tag */ }
  }
  return fallback;
}
```

Also add: `if (!COUNTRY_CODES.includes(countryCode)) countryCode = 'US'` in `loadSettings()`.
