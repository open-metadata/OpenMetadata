# Settings, marketplace and bots pages are classic-only; AI mode links open the settings modal

- **Status:** Accepted
- **Revisions:** v1 2026-10-21 (initial)
- **Deciders:** Chirag Madlani
- **Guard:** `AppModeRoutes.test.tsx` ("classic-only settings routes": the AI shell serves its
  not-found page for `/settings/*`, `/marketplace/*` and `/bots/*`, ahead of a plugin fallback);
  `SettingsModalLinkUtils.test.ts` (the path-to-hash table, its round-trip through each panel's
  parser, and classic vs AI output of the route builders)
- **Related:** `src/utils/SettingsModalLinkUtils.ts`, `hooks/useSettingsHash.ts`

## Context
In AI app mode settings live in the settings modal, addressed by a hash over the current page:
`#<tab>[/<subPath>]` (`useSettingsHash`). The AI shell also mounted the whole classic route table,
so `/settings/*`, `/marketplace*` and `/bots/*` rendered classic pages inside it, with
notification alerts on a third, AI-specific page. Each settings surface then existed twice in AI
mode and drifted. Redirecting those URLs to the modal was tried and rejected: it kept the classic
URLs alive as a second way in, and the redirect needed its own permission rules.

## Decision
- **AI mode serves no `/settings/*`, `/marketplace*` or `/bots/*` page.** `AppModeRoutes` routes
  them to the AI not-found page, ahead of the classic table and any plugin fallback router. No
  redirect.
- **Links are mode-aware.** Every link or `navigate()` to those pages goes through
  `getSettingsLink(path)`. In classic it returns the path unchanged. In AI it returns
  `#<tab>/<subPath>`, which opens the modal over the current page. The settings route builders
  (`getSettingPath` for concrete paths, `getTeamsWithFqnPath`, `getBotsPath`,
  `getNotificationAlertDetailsPath`…) return through it, so their callers are unchanged. The
  services listing maps to `/connections` instead, and a path with no equivalent is returned
  unchanged, so in AI mode it lands on not-found.
- **`settingsPathToHash` is the contract.** Classic path segments map to modal tabs and to the
  sub-paths each panel's own parser reads. A downstream distribution's settings pages join only
  by matching it. Collate's `/settings/billing/<page>` maps to `#billing/<page>`, so its billing
  page slugs must equal its modal slugs. `/settings/billing/plans` has no modal view.

## Consequences
A new modal tab or sub-view that replaces a classic page adds a row to `settingsPathToHash` and its
test. A classic page with no modal equivalent is unreachable in AI mode until it gets one.
Services, workflow definitions, edit-config forms and billing plans are in that state today. A
downstream router that mounts more `/settings/*` pages needs no change to keep them out of AI
mode. To link to them from AI mode, it maps them in `settingsPathToHash`. Revisit if AI mode gets
its own page for any of these trees.
