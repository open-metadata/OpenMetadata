# A contributed team tab opens its own panel-level sub-page via `onNavigate(subPath)`

- **Status:** Accepted
- **Revisions:** v1 2026-10-26 (initial)
- **Deciders:** UI team
- **Guard:** reviewer
- **Related:** open-metadata/OpenMetadata#36200, open-metadata/openmetadata-collate#7858

## Context

A tab contributed to `EXTENSION_POINTS.TEAM_DETAILS_TABS` rendered only inside the team detail's
tab body. A tab whose content is a full page — Collate's SQL Studio credential form is the first —
therefore drew under the tab bar, the team info widgets and the description, unlike the native
`teams-add` / `teams-import` forms, which replace the team detail entirely.

Hiding that chrome from inside the tab does not work: the host's two branches put the tab at
different depths in the element tree, so React unmounts and remounts it, losing the state that
asked for the sub-page. The view has to be swapped above the team detail, as the team forms are.

## Decision

- `MembersView` gains `team-tab-subpage`, carrying `fqn`, `teamId`, `key` and an optional
  `subPath`. `MembersPanel` renders it where the team detail would go.
- `PluginEntityDetailsContext` gains two optional fields:
  - `subPath` — the tab's own route below its key, passed back on render.
  - `onNavigate(subPath?)` — promotes one of the tab's routes to a panel-level sub-page;
    called with no argument, it returns to the team detail.
- The hash route is **`teams/<fqn>/tab/<key>/<teamId>[/<subPath>]`**. It carries the team **id**
  as well as the fqn because a contributed tab keys its API calls on the id (Collate's
  `queryRunner/team-configs?team=` rejects an fqn), and a deep link has no team loaded to resolve
  the id from.
- A host that does not support sub-pages omits `onNavigate`; the tab must then render in place.
  `MembersTeamDetail` supplies it, `TeamDetailsV1` (classic) does not.
- `team-tab-subpage` is gated on Teams access in `VIEW_ACCESS`, like `team-detail`.

## Consequences

- The route and both context fields are a contract downstream plugins depend on. Renaming a
  segment, dropping `teamId`, or changing the no-argument meaning of `onNavigate()` breaks every
  contributed tab that uses them, in a repository that does not build with this one.
- A tab reached through this view owns the whole content region and gets no tab bar, so it must
  offer its own way back — in practice by calling `onNavigate()`.
- `VIEW_ACCESS` is a `Partial` map and an unlisted view type defaults to **allowed**, so any
  further view type added to `MembersView` must be gated there deliberately.
