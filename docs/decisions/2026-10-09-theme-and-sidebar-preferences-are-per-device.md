# Theme and compact-sidebar preferences are per device, in localStorage

- **Status:** Accepted
- **Revisions:** v1 2026-10-09 (initial) · v2 2026-10-28 (compact also rails the submenu)
- **Deciders:** Chirag Madlani
- **Guard:** `theme-boot.test.ts` (the `index.html` boot script reads all three `ui-theme` values);
  `theme-provider.test.tsx` (`system` follows `prefers-color-scheme` live);
  `useSidebarState.test.ts` (a mounted sidebar applies `setCompactSidebarPreference`);
  `Sidebar.transitions.test.tsx` (compact rails the submenu inside a sub-context)
- **Related:** #35008, #35009

## Context
The Preferences page (Account) adds Theme (Light / Dark / System), Compact Sidebar and Language.
None of these has a backend field, and the theme must be applied before the bundle loads, or
the page flashes the wrong theme.

## Decision
- `localStorage['ui-theme']` is `light | dark | system`. Anything else is treated as unset, and
  the default is **light**. `system` resolves through `matchMedia('(prefers-color-scheme: dark)')`
  and follows OS changes while it is selected.
- Two readers must agree on those values: the `#theme-restore` boot script in `index.html` and
  `getStoredTheme`/`resolveTheme` in `theme-provider.utils.ts`. A new value goes into both, in
  the same PR.
- `localStorage['aiShell.sidebar.mainCollapsed']` (`'true'`/`'false'`) is the compact-sidebar
  preference. Code outside the sidebar changes it only through `setCompactSidebarPreference`,
  which persists the value and dispatches `aiShell.sidebar.mainCollapsedChange` on `window`. A
  mounted sidebar listens for that event and applies the value straight away. Both keys live in
  `appModeSidebar.constants.ts`.
- Language reuses the user menu's flow: load the locale, change the language, then reload.

## Consequences
No migration and no API change. Preferences do not roam, so a user sets them on each browser.
Moving them to the user profile would mean a backend field and a new record that supersedes
this one. The boot script cannot import TypeScript, so the duplicated value list is the price
of a flash-free first paint.

## Amendment

v2, 2026-10-28: compact means every nav panel shows as its icon rail. Inside a sub-context the main
nav is always railed, so the preference now decides how the submenu opens: railed when compact,
expanded otherwise. It applies on entering a sub-context and straight away when changed from
Preferences, which also drops any transient main-nav expand so only one full panel is ever open.
A user's submenu toggle stays transient and is never written back to the preference.
