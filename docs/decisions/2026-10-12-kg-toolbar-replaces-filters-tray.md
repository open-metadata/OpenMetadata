# The Knowledge Graph toolbar replaces the Filters tray: entity and relationship types are inline pickers, family and coverage-mode filters are retired

- **Status:** Accepted
- **Revisions:** v1 2026-10-12 (initial)
- **Deciders:** chirag-madlani (designer-review iterations R1–R9 against #33931)
- **Guard:** reviewer; `KnowledgeGraphToolbar` carries no `onClearFilters`/`hasFilters` prop and no `graph-filters-toggle` test id, and `useKnowledgeGraphExplorer` takes no `coverageMode`
- **Related:** #33931, #34035

## Context

The first Knowledge Graph (#33855) shipped a Filters tray behind a `graph-filters-toggle`
button that housed four filter surfaces: Entity Type, Relationship Type, Family (coarse
Lineage/Structure/Governance toggles), and a Coverage mode (`all` / `mapped` /
`unmapped` / `highlight`). The designer-review iterations on #33931 asked for a
simpler toolbar — the tray was a two-click detour for the two filters people actually
used, and Family and Coverage mode duplicated capabilities that already lived
elsewhere.

Three sub-features never ended up with a wiring: `onToggleFamily` stopped having a
renderer when the tray was deleted, `coverageMode` never got a replacement control
after the Gaps subtabs took over, and the `Clear Filters` button that lived inside
the tray lost its host. The leftover state and props shipped unused.

## Decision

- **Entity Type and Relationship Type pickers live inline on the toolbar.** Entity
  Type is grouped Explore-style (Databases / Dashboards / Owners / Other) by
  `groupEntityTypeChoices`; Relationship Type is a multi-select with a working
  select-all. Neither is behind a tray.
- **Family filter is retired.** Users who want to hide an entire family deselect its
  relationship types in the Relationship Type picker. The Legend still shows
  per-family counts and lets users select (highlight) one family at a time; it does
  not exclude.
- **Coverage-mode filter is retired on the canvas.** Mapped / Unmapped / Not-explored
  live in the Gaps subtabs of the details drawer (R7). The canvas renders every
  node regardless of coverage; the root's coverage is still annotated so
  `kg-node-gap` applies when the root entity is itself unmapped.
- **`Clear Filters` is reachable only from `KnowledgeGraphEmptyState`.** When filters
  narrow the result to zero, the empty state offers a Clear button; a Clear
  affordance for the non-empty case is tracked separately — if users ask for it,
  it goes on the toolbar as a chip adjacent to the active filters, not as a
  revived tray.

## Consequences

The toolbar is one row instead of a row-plus-popover; the dead `excludedFamilies`,
`familyCounts`, `onToggleFamily`, `coverageMode`, `onClearFilters` (on the toolbar),
and `hasFilters` props and state are gone. `filterGraphPresentation` collapsed to a
label-only pass (`relabelGraphNodes`); `annotateGraphCoverage` dropped its
`highlight` branch. `useKnowledgeGraphExplorer` no longer accepts `coverageMode`.
The Playwright spec dropped three `graph-filters-toggle` references.

What this forbids: re-adding family-exclude state or coverage-mode state in
`KnowledgeGraph.tsx` without first reviving a user-facing control for it, and
without a revision to this record. What revisits it: a user signal that
"deselect every type in a family" is too fiddly, or that the Gaps subtabs do not
cover enough of the Coverage dropdown's intent.
