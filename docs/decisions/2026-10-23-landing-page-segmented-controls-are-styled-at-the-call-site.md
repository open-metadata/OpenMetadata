# The landing page's segmented controls are styled at the call site until core ships a segmented variant

- **Status:** Accepted
- **Revisions:** v1 2026-10-23 (initial)
- **Deciders:** Landing page owners (design review Set 4)
- **Guard:** reviewer
- **Related:** ADR:2026-10-11-migrated-antd-components-adopt-core-styling, open-metadata/openmetadata-collate#7818, open-metadata/OpenMetadata#36096, open-metadata/openmetadata-collate#7820

## Context
Design review Set 4 specifies a segmented control for the landing page: a borderless gray track
with the chosen option raised on it, every option 12px semibold. No core component expresses it —
`ButtonGroup` draws joined bordered buttons and `Tabs`' `button-border` an outlined track with 14px
labels. Changing those core components was out of scope for the release that needed the design.

## Decision
Until `@openmetadata/ui-core-components` ships a segmented variant, these landing-page controls may
restyle core components from the call site, as an exception to
ADR:2026-10-11-migrated-antd-components-adopt-core-styling:

- the Topics list/grid switch over core `ButtonGroup`, and the Collapse/Expand all label and icon
  on core `Button` — classes in `TopicsSectionHeader.constants.ts`. The glyphs are core icons
  (`LayoutRows`, `LayoutColumns`, `ChevronSelectorVertical02`);
- the filter and stat chips' padding over core `ButtonGroup` / `Button` (`TopicFilterChips`,
  `TopicStatChips`);
- Collate's "Needs you now" tabs over core `Tabs` (`NeedsYouNow.utils.ts`).

The overrides stay in those modules; no other call site copies them.

## Consequences
These controls can drift when core restyles `ButtonGroup`, `Tabs` or `Button`, so a core change to
them is checked against the landing page in both themes. When core ships the variant, these call
sites move to it and this record is superseded.
