# In app mode a classic settings URL opens the settings modal when the user can see that tab

- **Status:** Accepted
- **Revisions:** v1 2026-10-20 (initial)
- **Deciders:** Chirag Madlani
- **Guard:** `settingsPathToHash.test.ts` (which paths map and which stay pages);
  `AppModeRoutes.test.tsx` (`SettingsModalRedirect` redirects only for a visible tab)
- **Related:** `components/platform/ai-shell/AppModeRoutes/settingsPathToHash.ts`,
  `components/discovery/personal-space/Profile/profileNavVisibility.ts`

## Context
In AI app mode settings live in the personal-space modal, addressed as `/my-data#<tab>[/<subPath>]`
(`useSettingsHash`). In-app links, bookmarks and other components still produce the classic
`/settings/...`, `/bots/...`, `/create-user...` and `/marketplace...` URLs. Rendered inside the AI
shell, those classic pages duplicate the modal and drift from it. Some classic routes have no modal
equivalent, and some already have dedicated AI pages that end-to-end specs pin. The modal hides
admin-only tabs, while the classic routes were gated on view permissions, so a blind redirect sent
a non-admin with Team view permission to their own Profile.

## Decision
- In AI app mode, the catch-all route redirects a classic settings URL to
  `/my-data#<tab>[/<subPath>]` when `settingsPathToHash` maps it **and** the target tab is visible
  for the current user, by the same `isVisible` rules the modal's nav uses
  (`PROFILE_NAV_VISIBILITY`). Otherwise the classic page renders with its own permission handling.
- Collate's billing page slugs equal their modal slugs: `/settings/billing/<page>` maps to
  `#billing/<page>`.
- `/settings/customProperties/<entityPath>` maps to `#custom-properties/<typeFqn>`, resolving the
  classic segment through `ENTITY_PATH` (`tables` → `table`); an unknown segment opens the bare
  `#custom-properties` landing.
- These stay page routes: notifications and alerts (dedicated AI pages in `SettingsRouter`),
  persona detail routes `/settings/persona/<name>/...`, services, workflow definitions, billing
  plans, and any path the mapper does not know.
- The bare `/settings` landing and `/create-user` also stay pages. They are generic entry points,
  not a specific settings tab: AI-mode flows (Collate's Ask Collate helpers open `/settings` and
  click its category tiles; its onboarding "Invite team" step lands on `/create-user`) drive them
  as classic pages, and redirecting them to `#profile` or `#members/users/create` would break those
  flows. `/create-user/bot` does map to `#bots/add`; nothing drives it as a page in AI mode.

## Consequences
A new modal tab or sub-page that replaces a classic page adds a mapper entry and a test case. A tab
whose visibility rule changes changes it in `profileNavVisibility.ts`, which governs both the nav
and the redirect. Tabs contributed by plugins (such as Collate's billing) have no core visibility
rule, so the redirect does not gate them; their own tab condition still applies in the modal.
Revisit if classic settings routes are removed from app mode altogether.
