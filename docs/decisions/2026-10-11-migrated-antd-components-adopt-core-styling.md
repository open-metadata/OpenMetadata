# Components migrated from Ant Design adopt the core component's styling

- **Status:** Accepted
- **Revisions:** v1 2026-10-11 (initial) · v2 2026-10-23 (landing-page segmented controls exception)
- **Deciders:** Harshit Shah
- **Guard:** reviewer
- **Related:** ADR:2026-10-11-antd-imports-are-frozen-by-eslint-suppressions, open-metadata/openmetadata-collate#6884, open-metadata/openmetadata-collate#6891, open-metadata/OpenMetadata#35209

## Context
Replacing an antd component with its `@openmetadata/ui-core-components` equivalent changes
padding, border, radius and surface: core `Card.Content` pads `px-6 py-3` where antd's card body
padded 20px, and core cards draw their own border and surface. The Card migration (100 cards in
68 files) had to decide whether each call site should restore the antd look. Restyling core
components from the caller makes the same component look different across screens, and those
overrides break silently when the core component changes.

## Decision
When an antd component is replaced by its `@openmetadata/ui-core-components` equivalent, call
sites accept the core component's padding, border, radius, surface and typography. They do not
restore antd visuals with caller-side overrides: no `className` or `style` that sets padding,
border, radius, shadow, background or text colour on the core component or its sub-components
(`Card.Header`, `Card.Content`, …), and no LESS or descendant selectors that reach into its
internals. Use the component's props (`variant`, `color`, `size`) and sub-components instead.
Caller-side layout (width, margin, flex or grid placement, scroll containers) is allowed.

A visual gap that the core API cannot express is fixed in the core component, not at the call
site. Visual-regression baselines that change only because of core styling are updated in the
migration PR.

## Consequences
Screens change slightly when a component migrates, and the PR's before/after screenshots and
refreshed baselines show it. Layout that depended on antd internals (`.ant-card-body`,
`.ant-card-head`) moves onto the call site's own children rather than onto the core component.
Revisit only if the design system adopts per-screen variants, which would then be added as core
props.

## Amendment — v2: landing-page segmented controls

The landing page's segmented controls — the Topics list/grid switch, the Collapse/Expand all
control, the topic filter and stat chips, and Collate's "Needs you now" tabs — restyle core
components from the call site until core ships a segmented variant. The scope and exit are in
ADR:2026-10-23-landing-page-segmented-controls-are-styled-at-the-call-site.
