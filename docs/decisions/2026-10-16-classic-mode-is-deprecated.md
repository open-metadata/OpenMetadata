# Classic mode is deprecated; the UI says so only where the mode is chosen

- **Status:** Accepted
- **Revisions:** v1 2026-10-16 (initial)
- **Deciders:** Pere Miquel Brull (product), Chirag Madlani (UI), Reethika (design)
- **Guard:** `AppModeSwitcher.test.tsx`, `InterfaceModeMenuItem.test.tsx`,
  `DefaultAppModePage.test.tsx` (Deprecated badge and notice on the Classic option only)
- **Related:** open-metadata/openmetadata-collate#7533, #35609,
  ADR:2026-10-12-dark-mode-targets-ai-mode-core-surfaces-only

## Context
AI mode is the go-forward interface, and Classic mode will be removed. Users and admins need
to hear that before it happens. Product asked that the product itself not be invasive about
it: the main channel is the release notes, and the UI should not nag every user on every page.

## Decision
- Classic mode is deprecated as of 2026-10. It stays fully supported until the release that
  removes it, which the release notes will name.
- The UI marks Classic as *Deprecated* (core warning `Badge`), with a short notice and a link
  to the release notes, only where the mode is chosen:
  - the AI-shell mode switcher and the classic profile dropdown, on the Classic option once the
    menu is open (a `HoverCard` on hover or keyboard focus). It is never on the always-visible
    switcher trigger;
  - the admin *Default App Mode* setting, as a hint under the Classic radio.
- The shipped copy promises the following, and the removal release must honour it: an
  organization `defaultAppMode` or persona app mode still set to Classic is moved to AI, and a
  user switching from Classic to AI keeps their settings.

## Consequences
New surfaces that offer a Classic/AI choice add the same badge and notice; nothing else
mentions the deprecation. The removal release owns the migration of Classic values to AI. If
product drops that migration, change the copy (`message.classic-mode-retiring-*`) in the same
release and amend this record. ADR:2026-10-12-dark-mode-targets-ai-mode-core-surfaces-only
already scopes dark mode to AI mode; once Classic is removed, its Classic carve-out no longer
applies.
