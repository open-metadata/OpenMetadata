# Column uniqueness means the column alone is unique

- **Status:** Accepted
- **Revisions:** v1 2026-11-13 (initial)
- **Deciders:** OpenMetadata RDF maintainers
- **Guard:** `RdfPropertyMapperTest#testKeyUniquenessAppliesToTheWholeConstraint`,
  `RdfEntityDiffWriteIT#constraintChangesReplaceMembersAndColumnUniqueness`
- **Related:** #37755, #37756

## Context

A composite key permits duplicate values in each member column. Marking every member
`om:isUnique true` gives graph consumers an incorrect guarantee.

## Decision

`om:isUnique true` means the column alone is unique. A column-level PRIMARY_KEY or UNIQUE
constraint, or a single-column PRIMARY_KEY or UNIQUE table constraint, supplies this fact.

Composite constraints express group uniqueness through `om:hasConstrainedColumn` on the
constraint resource. Membership alone does not imply individual uniqueness. An independent
single-column constraint can still make a composite-key member individually unique.
Primary-key members retain `om:isPrimaryKey true` and `om:isNullable false`.

## Consequences

Queries for individually unique columns exclude members supported only by composite keys.
An entity rewrite removes the incorrect flags. A recreate RDF reindex repairs the existing catalog.
