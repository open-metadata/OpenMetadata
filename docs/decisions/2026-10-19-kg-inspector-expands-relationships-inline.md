# The Knowledge Graph inspector expands up to 40 relationships in place, and detail cells show up to 5 tag or term chips

- **Status:** Accepted
- **Revisions:** v1 2026-10-19 (initial)
- **Deciders:** chirag-madlani (design review round 2, #35745)
- **Guard:** `KnowledgeGraphOverlays.test.tsx` ("expands at most 40 relationships in the drawer and hands larger sets to the paged list"); `KnowledgeGraphDetails.test.tsx` ("shows tags and glossary terms as chips, five inline and the rest in a popover…")
- **Related:** #35745, ADR:2026-10-12-kg-toolbar-replaces-filters-tray

## Context

Design review asked for "View all relationships" in the node inspector to open in the drawer
itself, not in the bottom details table. A node's relationship list has no natural bound: a
table at level 2 can carry several hundred column edges, and the inspector renders every row
as a full button, with no paging or virtualisation. The details table already pages 40 rows at
a time.

The same review asked for tag and glossary-term cells in the details tables to show chips, with
the overflow collapsed behind "+N more". A column can carry dozens of terms, and an uncapped
chip list makes every row as tall as its longest cell.

## Decision

- **Inspector:** "View all relationships" expands the list in place, up to
  **40** rows (`INLINE_RELATIONSHIPS`, matching the details table's page size). Past 40 it
  offers "View in list", which opens the paged relationships table scoped to that node's edges.
  The expanded state survives drilling into a relationship and coming back.
- **Detail cells:** tag and glossary-term cells render through the shared `TagsViewer` with
  `sizeCap` **5** (`CHIP_LIMIT`); "+N more" opens the rest in a popover. Opening it does not
  select the row.

## Consequences

The common case, a node with a few dozen relationships, stays in the drawer as the design
asks. The worst case is bounded at 40 rows, and the full set is still reachable through the
paged table. Raising either number trades layout stability for fewer clicks. Revisit if the
inspector list becomes virtualised, or if design wants a different overflow pattern for chips.
