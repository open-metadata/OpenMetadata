# The settings modal's breadcrumb root is the sidebar group, and it is not a link

- **Status:** Accepted
- **Revisions:** v1 2026-11-16 (initial)
- **Deciders:** UI team
- **Guard:** `ProfilePage.test.tsx` ("roots a panel breadcrumb at its sidebar group, not navigable")
- **Related:** open-metadata/OpenMetadata#37878

## Context
Each settings panel built its own breadcrumb trail and hard-coded the first crumb, usually
"Settings" and once "Workspace", so the root disagreed with the sidebar group the page sits under.
The root was also clickable, though it only repeated what the next crumb does.

## Decision
`ProfilePage` owns the first crumb. It renders the active item's sidebar group
(`PROFILE_NAV_GROUP_LABEL`: Account / Administration / Features / Workspace / Credentials) with
`isDisabled`, so it is plain text, not a link. `ProfileHeaderOverride.breadcrumbs`, and the override
a contributed tab pushes through `onHeaderChange`, stays a full trail that leads with a root crumb.
`ProfilePage` replaces that crumb by position. A panel that passes an empty trail gets only the
root.

## Consequences
Panels, including those contributed downstream, need no change and cannot get the root wrong.
A panel must still lead its trail with a placeholder root. A trail that starts directly with a page
crumb loses that crumb. Switching to "panels pass only the crumbs below the root" would make this
explicit, but every panel and every downstream contribution would have to change in the same
release, or they would render the root twice.
