# A reference list names only entities the caller may view

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `DomainIsolationIT.test_referenceListsLeaveOutEntitiesOfAnotherDomain`
- **Related:** open-metadata/openmetadata-collate#8018

## Context
A user's `owns` and `follows`, a team's `owns`, `children`, `descendantTeams` and `parents`, a
schema's `tables` and a database's `databaseSchemas` were returned as the repository filled them,
so a caller read the names and descriptions of entities its policies refused it.

## Decision
A resource declares its reference-list fields whose targets are filtered
(`EntityResource.viewFilteredReferenceFields`). On GET and list responses each target stays only
if the caller may view it, checked in one batch per target type, and only for target types where a
row-dependent rule could refuse it (`RowDecisionGate`).

## Consequences
Lists of references can be shorter than what is stored. A new reference-list field that points at
policy-protected entities is added to its resource's list.
