# Lineage canvas hit tests trigger pipeline previews

- **Status:** Accepted
- **Revisions:** v1 2026-11-26 (initial)
- **Deciders:** OpenMetadata contributors
- **Guard:** `CanvasEdgeRenderer.browser.test.tsx` and `hover-card.test.tsx`
- **Related:** #38813

## Context

React Flow's pane owns pointer events over the canvas. The canvas can hit-test a
pipeline icon, but a DOM trigger rendered underneath a stationary pointer does
not receive the event that normally opens a preview.

## Decision

The canvas passes its hit to the shared HoverCard through
`isExternalTriggerHovered`. The renderer retains one passive anchor while the
card's close delay, pointer hover, or keyboard focus keeps the preview open.
`onCloseComplete` releases that anchor. The edge and annotator identify the
preview. Removing the hit geometry or changing the viewport dismisses it.

## Consequences

The pane still handles clicks and gestures. HoverCard owns the timing, portal,
focus, and keyboard dismissal for both DOM triggers and canvas-triggered
previews.
