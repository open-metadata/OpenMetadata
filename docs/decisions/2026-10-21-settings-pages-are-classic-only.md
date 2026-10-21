# Settings, marketplace and bots pages are classic-only; AI mode links open the settings modal

- **Status:** Accepted
- **Revisions:** v1 2026-10-21 (initial); v2 2026-10-21 (links keep the page query string; modal
  tabs and views follow classic's view permissions); v3 2026-10-21 (a team link carries its tab);
  v4 2026-10-21 (billing plans map to `#billing/plans`)
- **Deciders:** Chirag Madlani
- **Guard:** `AppModeRoutes.test.tsx` ("classic-only settings routes": the AI shell serves its
  not-found page for `/settings/*`, `/marketplace/*` and `/bots/*`, ahead of a plugin fallback);
  `SettingsModalLinkUtils.test.ts` (the path-to-hash table, its round-trip through each panel's
  parser, and classic vs AI output of the route builders); `useSettingsHash.test.tsx` (a followed
  link keeps the query string and closing returns to the page entry); `profileNavConfig.test.tsx`,
  `ProfilePage.test.tsx`, `MembersPanel.test.tsx`, `AccessControlPanel.test.tsx` (view-permission
  gates and the no-access state)
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
  `<current search>#<tab>/<subPath>`, which opens the modal over the current page. The search is
  part of the link because react-router resolves a bare `#hash` target with an empty search.
  Closing a modal a link opened goes back to the page's own history entry instead of adding a
  duplicate of it. The settings route builders
  (`getSettingPath` for concrete paths, `getTeamsWithFqnPath`, `getBotsPath`,
  `getNotificationAlertDetailsPath`…) return through it, so their callers are unchanged. The
  services listing maps to `/connections` instead, and a path with no equivalent is returned
  unchanged, so in AI mode it lands on not-found.
- **The modal shows what classic showed.** A tab that replaces classic pages is visible to an
  admin or to anyone holding the view permission classic's `SettingsRouter` gated those pages on:
  Members on TEAM or USER, Access Control on ROLE or POLICY, Bots on BOT. Inside a tab each view
  keeps its own classic gate (team list on TEAM, user list on USER, roles on ROLE, policies on
  POLICY, audit logs on `AuditLogs`, the permission debugger admin-only), and edit actions follow
  the entity's own permissions. A hash naming a tab or view the user cannot open shows the
  permission placeholder, never another tab.
- **`settingsPathToHash` is the contract.** Classic path segments map to modal tabs and to the
  sub-paths each panel's own parser reads. A downstream distribution's settings pages join only
  by matching it. Collate's `/settings/billing/<page>` maps to `#billing/<page>`, so its billing
  page slugs must equal its modal slugs, `plans` included. A team
  page's `?activeTab=<key>` maps to `#members/teams/<fqn>?activeTab=<key>`, which the team
  detail opens on once that tab exists (built-in or contributed); build it with
  `getTeamsWithFqnPath(fqn, { activeTab })`.

## Consequences
A new modal tab or sub-view that replaces a classic page adds a row to `settingsPathToHash` and its
test. A classic page with no modal equivalent is unreachable in AI mode until it gets one.
Services, workflow definitions and edit-config forms are in that state today. A
downstream router that mounts more `/settings/*` pages needs no change to keep them out of AI
mode. To link to them from AI mode, it maps them in `settingsPathToHash`. Revisit if AI mode gets
its own page for any of these trees.
