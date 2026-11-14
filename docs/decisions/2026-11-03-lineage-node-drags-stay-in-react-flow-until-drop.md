# Lineage node drags stay inside React Flow until the drop

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Chirag Madlani
- **Guard:** `useUncontrolledNodeDrag.test.tsx` and `UncontrolledDragFlow.test.tsx` (no drag frame
  reaches the caller; the drop commits the dragged position; a parent re-render mid-drag keeps it);
  `useCanvasEdgeRenderer.test.ts` (a dragged node's edges are skipped); `LineageControls.spec.ts`
  "Node drag"
- **Related:** #36362

## Context
Both lineage canvases (the asset Lineage tab and the platform Lineage map) pass controlled nodes to
React Flow v11. Every drag frame went through `onNodesChange` into React state and back into React
Flow's store. With auto-pan at the canvas edge that round-trip ran several times per animation
frame and crashed the page with "Maximum update depth exceeded".

## Decision
- On both canvases, drag frames update React Flow's store only. The caller's `onNodesChange`
  receives no drag frames, only the drop, with the final position filled in.
- Until the drop, a dragged node's live position exists only in React Flow's store. Anything that
  reads positions during a drag uses `useNodes` / `getNode`, not the lineage store's `nodes` or
  `LineageMap`'s `nodes` state. Nodes handed to `<ReactFlow>` go through
  `useUncontrolledNodeDrag`, which lays the in-flight positions over them so that a parent
  re-render mid-drag does not reset the dragged node.
- A dragged node's edges are hidden until the drop; every other edge keeps drawing.

## Consequences
Dragging no longer re-renders the lineage tree per frame, and auto-pan no longer crashes the page.
A new lineage canvas, or a feature that tracks node positions live (minimap overlays, alignment
guides), has to read React Flow's store or route through the hook. Revisit on upgrading to
`@xyflow/react` v12, whose store updates are not synchronous.
