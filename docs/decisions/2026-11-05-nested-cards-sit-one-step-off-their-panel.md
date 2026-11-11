# A card nested in a dark panel sits one step off the panel, and rail icons rest on quaternary

- **Status:** Accepted
- **Revisions:** v1 2026-11-05 (initial)
- **Deciders:** Harshit Shah
- **Guard:** reviewer; `ExploreSearchCard.test.tsx` pins the `variant` passthrough
- **Related:** 2.1.0 release-testing "Dark theme" findings, ADR:2026-10-27-settings-modal-surfaces-use-the-muted-step, ADR:2026-10-12-dark-mode-targets-ai-mode-core-surfaces-only

## Context

2.1.0 release testing reported cards in AI-mode dark that were either the same gray-800 as the
panel or modal around them (lineage summary cards, the Explore export-scope cards, Add Service
connector tiles, the ontology library cards, domain Data Products), or gray-950 inside a gray-800
or gray-900 container (domain Assets, the Add Service "Name this service" card, Metadata Agents
rows). The reports pulled in both directions ("should be dark", "should be light") because each
looked at one screen. Taken together, they asked for one rule. The same pass found the collapsed
rail's rest icons (gray-600) dimmer than the list icons in page widgets such as Context Center
(quaternary, gray-400).

## Decision

- A card that sits inside a panel, modal or drawer on `bg-surface` / `bg-overlay-surface`
  (gray-800 in dark) uses the muted step: core `Card variant="muted"` or `"tile"`, or
  `--tw-background-color-primary_alt` in LESS (gray-900 in dark, white in light).
- A card whose container is already gray-900 (an `AgentGroup`) uses `bg-surface`, one step up.
- No card uses `bg-primary` (gray-950, the page colour in dark), and a row of sibling section
  cards shares one surface.
- `ExploreSearchCard` takes a core `variant` and its LESS no longer pins `bg-surface`, so the
  variant reaches the card. Callers inside a surface panel pass `variant="muted"`.
- The shared `.assets-tab-container` is a `bg-surface` panel in dark, and its cards are muted.
- Sidebar rest icons use `text-quaternary` in both themes. The dark-only gray-600
  `--ask-rest-icon` override is removed.
- The dark features-empty-placeholder gradient's middle is `bg-surface` (the card it sits on), and
  its tints stay translucent at both ends.

## Consequences

Light mode is unchanged: muted, surface and primary are all white there. A new nested card picks
a step from its parent instead of a fixed token. Revisit if the dark surface ladder
(950 / 900 / 800) changes.
