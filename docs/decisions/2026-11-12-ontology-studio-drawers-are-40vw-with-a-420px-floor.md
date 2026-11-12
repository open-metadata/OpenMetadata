# Ontology Studio side drawers are 40% of the screen wide, never narrower than 420px

- **Status:** Accepted
- **Revisions:** v1 2026-11-12 (initial)
- **Deciders:** UI team
- **Guard:** reviewer
- **Related:** open-metadata/OpenMetadata#37577, open-metadata/OpenMetadata#37607

## Context

The Ontology Studio design handoff opens its side panels (concept inspector, New concept,
relationship and data-asset panels) as drawers that take a fixed share of the screen, full height,
over the right of the page header, with nothing behind them dimmed. The canvas stays usable while
a drawer is open, so the selected node must not end up under it.

## Decision

- Every Studio drawer uses `PANEL_WIDTH` = **`tw:w-[40vw] tw:min-w-105`** (`OntologyStudioDrawer.tsx`):
  40% of the viewport, never narrower than 420px.
- The drawer opens full height with no backdrop. In View mode the canvas reserves a gap of the same
  `PANEL_WIDTH` beside it, so the graph narrows and the selected node stays visible.
- 420px is the narrowest width at which the drawers' two-column form rows and their footer
  (Cancel, Create & add another, Create) fit without wrapping. Conversation drawers use 480px
  (ADR:2026-10-24-conversation-drawers-are-40vw-wide-with-a-480px-floor) because their header row
  and reply composer need more room; the Studio forms do not.

## Consequences

- The drawer and its canvas gap share one constant; change it there, never at a call site.
- On viewports where 40vw is under 420px the floor wins and the drawer covers more of the canvas.
