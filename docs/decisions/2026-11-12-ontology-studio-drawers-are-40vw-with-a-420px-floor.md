# Ontology Studio side drawers are 40% of the screen wide, never narrower than 420px

- **Status:** Accepted
- **Revisions:** v1 2026-11-12 (initial); v2 2026-11-12 (drawers overlay the canvas edge to edge; no canvas gap)
- **Deciders:** UI team
- **Guard:** reviewer
- **Related:** open-metadata/OpenMetadata#37577, open-metadata/OpenMetadata#37607

## Context

The Ontology Studio design handoff opens its side panels (concept inspector, New concept,
relationship and data-asset panels) as drawers that take a fixed share of the screen, full height,
over the right of the page header, with nothing behind them dimmed.

v1 also narrowed the canvas by the drawer's width so the selected node stayed visible. Design review
rejected it: opening a drawer re-centred the canvas and its empty states, so the page appeared to jump,
and the drawer was inset from the screen edges unlike every other drawer in the app.

## Decision

- Every Studio drawer uses `PANEL_WIDTH` = **`tw:w-[40vw] tw:min-w-105`** (`OntologyStudioDrawer.tsx`):
  40% of the viewport, never narrower than 420px.
- The drawer is fixed to the viewport's right edge, top to bottom (`inset-y-0 right-0`, square
  corners, a left border), like the core `SlideoutMenu`, with no backdrop.
- It overlays the canvas. The canvas keeps its size and nothing under it moves; only the canvas
  toolbar shifts left so full screen stays reachable.
- 420px is the narrowest width at which the drawers' two-column form rows and their footer
  (Cancel, Create & add another, Create) fit without wrapping. Conversation drawers use 480px
  (ADR:2026-10-24-conversation-drawers-are-40vw-wide-with-a-480px-floor) because their header row
  and reply composer need more room; the Studio forms do not.

## Consequences

- The width lives in one constant; change it there, never at a call site.
- A node or empty state under the drawer can be covered; the person pans or closes the drawer.
- On viewports where 40vw is under 420px the floor wins and the drawer covers more of the canvas.
