# Lineage semantic zoom drills at 35% screen fill, once the zoom settles

- **Status:** Accepted
- **Revisions:** v1 2026-10-27 (initial); v2 2026-11-04 (a settled zoom is judged against the
  zoom it last rested at); v3 2026-11-12 (a zoom-out at the minimum zoom goes up a level)
- **Deciders:** Chirag Madlani
- **Guard:** `LineageMap.utils.test.ts` (threshold either side of 35%, nearest-centre box,
  drillable-with-children predicate); `PlatformLineage.spec.ts` (a fast zoom-in past the maximum
  still drills; the zoom-out button and a wheel step over the canvas at the minimum zoom go up to
  the parent level, on a scene too wide to leave by the one-third rule); the settle delay and
  targeting are `reviewer`
- **Related:** #36363, #36370

## Context
On the platform Lineage map, zooming in drilled one level when the widest card filled 60% of the
canvas. A 340px service card on a ~1400px canvas reached that at zoom 2.45 against a 2.5 maximum,
so drilling read as "zoom all the way in". Button and keyboard zoom drilled only when exactly one
drillable node was in view, so on a full map they never drilled. Lowering the threshold without a
pause would drill when a pinch overshoots while the user only zooms in to read a card.

## Decision
- Zooming in drills one level once the card being zoomed into fills 35% of the canvas on either
  axis (`ZOOM_IN_SCREEN_FILL`); with no target, the widest card. The 2.5 maximum-zoom fallback
  stays. The value was tuned on a dev build: ~1.43 zoom for a service card, ~1.21 for an asset.
- The target is the drillable card under the pointer (wheel, pinch); otherwise the selected card;
  otherwise the drillable card with children nearest the canvas centre, within the middle half of
  each axis (`ZOOM_TARGET_CENTRE_REGION`). Empty containers are never an unaimed target, because
  the scene API marks them expandable; the rail then falls back to `getRailDrillFallbackNode`.
- A drill fires only after the viewport has been still for 250ms
  (`SEMANTIC_ZOOM_IN_SETTLE_MS`); any further move, a pan included, restarts that wait. When the
  viewport settles, it is compared with the zoom it last rested at, not with the move before:
  once the zoom reaches its maximum, the wheel keeps sending moves that no longer change the zoom.
- Zooming out is unchanged: it returns to the parent level as soon as the graph fills less than a
  third of the canvas.

## Consequences
Drilling takes about half the wheel steps it did. A user zooming in only to read a card drills a
level sooner; the settle delay and the pointer-aimed target keep that deliberate. Revisit the
threshold if card widths or the default landing zoom change, and drop the children check once the
API stops marking empty containers expandable.

## Amendment (v3, 2026-11-12)
At the minimum zoom a zoom-out no longer moves the viewport, so no move arrives to judge against
the one-third rule and a large scene could not be left by zooming out. There, the zoom-out
gesture itself (a wheel step down over the canvas, or the zoom-out button) goes up one level,
mirroring the drill at the maximum zoom. It honours the same semantic-zoom cooldown and
suppression after a fit, and counts only wheel events over the React Flow renderer (where d3-zoom
listens) and not in a `.nowheel` element, so scrolling a dialog, menu or panel over the map does
not navigate it. Above
the minimum zoom, zooming out still follows the one-third rule.
