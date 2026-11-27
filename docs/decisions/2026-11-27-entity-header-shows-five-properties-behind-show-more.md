# The entity header shows five properties and the rest behind Show more

- **Status:** Accepted
- **Revisions:** v1 2026-11-27 (initial)
- **Deciders:** OpenMetadata UI maintainers
- **Guard:** `EntityHeaderProperties.test.tsx`, `HeaderPropertyField.test.tsx`,
  `EntityHeaderProperties.browser.test.tsx`
- **Related:** #19518

## Context
The entity header drew every property it had in one wrapping row: Domains, Owners, Tier,
Certification and Retention Period, then each entity type's read-only facts (type, usage, rows,
project, algorithm, …). A long row pushed the facts users look for out of view, and each property
drew its own label and empty state, so the same header mixed label sizes and empty values.

## Decision
- The header shows its first `COLLAPSED_HEADER_PROPERTY_COUNT` (5) properties and puts the rest
  behind Show more. The count is fixed, not measured from the available width.
- The order is the standard properties (Domains, Owners, Tier, Certification, Retention Period),
  then the entity type's own properties, then the time the asset last changed at its source.
- Each property is a cell keyed by a `HeaderPropertyId`. The cell draws the label, the edit
  trigger and the empty state; a property supplies its value and, when the viewer may edit it,
  its editor.
- An empty read-only property is not shown. An empty editable property shows Add, which opens
  its editor, to a viewer who may edit it, and `--` to anyone else.
- Test ids stay on the cell: `header-property-<id>` for the cell, the property's own container id
  (`header-tier-container`, `header-owner-container`, …) and its editor trigger (`edit-tier`,
  `edit-owner`, `add-domain`, …) in both the empty and the set state.

## Consequences
A property past the fifth needs Show more before it is visible, so a spec or helper asserting on
it expands the header first (`expandHeaderProperties`). Changing the count or the order moves
properties in and out of view on every entity page, so revisit it only with the design.
