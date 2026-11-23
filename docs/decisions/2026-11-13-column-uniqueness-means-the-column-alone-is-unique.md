# Column uniqueness means the column alone is unique

- **Status:** Accepted
- **Revisions:** v1 2026-11-13 (initial) · v2 2026-11-17 (ordered members, column-level composite keys)
- **Deciders:** OpenMetadata RDF maintainers
- **Guard:** `RdfPropertyMapperTest#testKeyUniquenessAppliesToTheWholeConstraint`,
  `RdfEntityDiffWriteIT#constraintChangesReplaceMembersAndColumnUniqueness`,
  `RdfTableKeyProjectionTest`,
  `RdfEntityWritePlannerTest#aKeyThatLosesMembersOrIsDroppedLeavesOnlyWhatItStillStates`
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

## Amendment 2026-11-17. Ordered members and column-level composite keys

A table has one primary key, so column-level PRIMARY_KEY markers on several columns state one
composite key, not several single-column ones. Without a PRIMARY_KEY table constraint they project
as one `om:TableConstraint` over those columns in column order, at
`<table>/constraint/PRIMARY_KEY/<number of tableConstraints>`. A column-level PRIMARY_KEY supplies
`om:isUnique` only when no other column of the table carries one and the column is not a member of
a multi-column PRIMARY_KEY table constraint; a column-level UNIQUE marker or a single-column key of
its own still makes such a member unique. Members keep `om:isPrimaryKey true` and
`om:isNullable false`, as above.

Every constraint lists its columns as `om:ConstraintMember` nodes
(`<constraint>/member/<position>`) carrying `om:memberPosition` from 1, `om:memberColumn` and, for
a foreign key, the referred column at the same position as `om:memberReferredColumn`.
`om:hasConstrainedColumn`, `om:hasReferredColumn` and `om:references` are unchanged. The table owns
the members and the column nodes its constraints name, including a name it has no column for, so a
write that removes a member or a constraint leaves none of their triples
(ADR:2026-11-03-live-rdf-entity-writes-send-only-the-changed-triples).
