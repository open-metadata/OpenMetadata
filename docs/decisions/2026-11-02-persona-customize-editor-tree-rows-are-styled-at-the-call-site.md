# Persona customize editor tree rows and category cards are styled at the call site until core ships a divided tree row

- **Status:** Accepted
- **Revisions:** v1 2026-11-02 (initial)
- **Deciders:** Rohit Jain
- **Guard:** reviewer
- **Related:** ADR:2026-10-11-migrated-antd-components-adopt-core-styling, open-metadata/OpenMetadata#36707, open-metadata/OpenMetadata#36862

## Context
The settings modal's persona editors (Navigation in classic mode, the AI sidebar in AI mode) list the
sidebar as full-width rows divided by a rule, 40px tall, with the hover fill and the divider running
edge to edge. No core component expresses that row. Core `Tree.ItemContent` rounds each row, pads it
`py-1.5 pr-1.5`, and indents a nested row with an inline `marginLeft`
(`tree.tsx`, `TreeItemContentComponent`), so a divider or hover fill drawn on the row stops short at
the indent and shows rounded ends. The persona category tiles have the same kind of gap: core
`Card.Content` pads `px-6`, which leaves the icon and two-line description cramped in a three-column
grid.

## Decision
Until `@openmetadata/ui-core-components` ships a full-bleed, divided `Tree` row variant and a compact
`Card.Content` padding, these call sites may restyle core components, as an exception to
ADR:2026-10-11-migrated-antd-components-adopt-core-styling:

- `Tree.Item` in `customize/NavigationEditor.tsx` and `customize/AiSidebarEditor.tsx`:
  `tw:rounded-none tw:border-b tw:border-secondary tw:last:border-b-0`;
- `Tree.ItemContent` in the same two files: `tw:ml-0! tw:h-10 tw:rounded-none tw:py-0 tw:pr-3.5`
  with `tw:pl-4` for a top-level row and `tw:pl-10` for a nested one. The `!` cancels the core's
  inline `marginLeft`, and the padding replaces it so the hover fill and divider stay full width;
- the editor `Card` in the same two files: `tw:overflow-hidden tw:rounded-xl`, which clips the rows
  to the card's corners;
- `Card.Content` in `PersonaCustomizeGrid.tsx` and `customize/SubCategoryGrid.tsx`: `tw:px-3`.

The overrides stay in those four modules; no other call site copies them.

## Consequences
These rows can drift when core changes `Tree` indentation, radius or padding, or `Card.Content`
padding, so a core change to them is checked against the persona editors in both themes. When core
ships a divided full-bleed tree row and a compact card padding, these call sites move to them and
this record is superseded.
