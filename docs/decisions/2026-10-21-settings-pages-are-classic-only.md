# Settings, marketplace and bots pages are classic-only; AI mode links open the settings modal

- **Status:** Accepted
- **Revisions:** v1 2026-10-21 (initial); v2 2026-10-21 (links keep the page query string; modal
  tabs and views follow classic's view permissions); v3 2026-10-21 (a team link carries its tab);
  v4 2026-10-21 (billing plans map to `#billing/plans`); v5 2026-10-21 (Members, Access Control
  and Bots are admin-only again; a hash naming a hidden tab keeps the no-access state); v6
  2026-10-21 (route builders stay pure paths; links resolve through `getSettingsLink` at the
  call site)
- **Deciders:** Chirag Madlani
- **Guard:** `AppModeRoutes.test.tsx` ("classic-only settings routes": the AI shell serves its
  not-found page for `/settings/*`, `/marketplace/*` and `/bots/*`, ahead of a plugin fallback);
  `SettingsModalLinkUtils.test.ts` (the path-to-hash table, its round-trip through each panel's
  parser, classic vs AI output of `getSettingsLink`, the builders staying paths in AI mode, and the
  development warning for an unmapped path); `PersonaDetailsCard.test.tsx` (a `pathname:` caller
  in AI mode); `useSettingsHash.test.tsx` (a followed link keeps the query string, closing returns
  to the page entry, and a push is counted once per hook instance); `profileNavConfig.test.tsx`,
  `ProfilePage.test.tsx` (admin-only tabs and the no-access state); `ProfileOnlineUser.spec.ts`
  ("Non-admin users cannot access the Members surface")
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
- **Route builders are paths; links are mode-aware at the call site.** The settings route
  builders (`getSettingPath`, `getTeamsWithFqnPath`, `getBotsPath`,
  `getNotificationAlertDetailsPath`…) always return the classic path, so a builder result is safe
  as a `pathname:`. A link or `navigate()` to those pages that AI mode can reach wraps it in
  `getSettingsLink(path)`: the entity-link, owner, breadcrumb and audit-log utils, the popovers,
  and the modal's own panels do. In classic it returns the path unchanged. In AI it returns
  `<current search>#<tab>/<subPath>`, which opens the modal over the current page; it is a link,
  never a `pathname`. The search is part of the link because react-router resolves a bare
  `#hash` target with an empty search. `getSettingsLink` reads the mode and the search when
  called, so it is called at click time or during render, never at module scope or in a memo.
  Closing a modal a link opened goes back to the page's own history entry instead of adding a
  duplicate of it; the hook instance that closes it owns that count. The services listing maps
  to `/connections` instead. A path with no equivalent is returned unchanged, so in AI mode it
  lands on not-found, and development builds warn with the path.
- **The settings tabs are admin-only.** Members, Access Control and Bots show to admins only,
  whatever view permissions a non-admin holds on TEAM, USER, ROLE, POLICY or BOT; edit actions
  inside them follow the entity's own permissions. A hash naming a tab the user cannot see (a
  settings link to a team, role or policy, followed by a non-admin) shows that tab's header with
  the permission placeholder, never another tab such as the user's own Profile.
- **`settingsPathToHash` is the contract.** Classic path segments map to modal tabs and to the
  sub-paths each panel's own parser reads. A downstream distribution's settings pages join only
  by matching it. Collate's `/settings/billing/<page>` maps to `#billing/<page>`, so its billing
  page slugs must equal its modal slugs, `plans` included. A team
  page's `?activeTab=<key>` maps to `#members/teams/<fqn>?activeTab=<key>`, which the team
  detail opens on once that tab exists (built-in or contributed); build it with
  `getSettingsLink(getTeamsWithFqnPath(fqn, { activeTab }))`.

## Consequences
A new modal tab or sub-view that replaces a classic page adds a row to `settingsPathToHash` and its
test. A classic page with no modal equivalent is unreachable in AI mode until it gets one.
Services, workflow definitions and edit-config forms are in that state today. A
downstream router that mounts more `/settings/*` pages needs no change to keep them out of AI
mode. To link to them from AI mode, it maps them in `settingsPathToHash` and wraps its links in
`getSettingsLink`; a bare builder result keeps working in classic only. Revisit if AI mode gets
its own page for any of these trees.
