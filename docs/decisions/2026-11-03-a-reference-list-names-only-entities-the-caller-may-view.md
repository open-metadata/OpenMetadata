# A reference list names only entities the caller may view

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `DomainIsolationIT.test_referenceListsLeaveOutEntitiesOfAnotherDomain`,
  `ReferenceListWriteBackIT`, `ShownReferenceListsTest`
- **Related:** open-metadata/openmetadata-collate#8018

## Context
Some fields list references to other entities: a user's `owns` and `follows`, a team's `owns`,
`children`, `descendantTeams` and `parents`, a schema's `tables` and a database's
`databaseSchemas`. Each reference carries its target's name and description, so a list names only
the targets the caller may view, as their own endpoints decide. A write keeps the entries its
caller was not shown.

## Decision
A resource declares its reference-list fields whose targets are filtered
(`EntityResource.viewFilteredReferenceFields`). On GET, list, PUT and PATCH responses each target
stays only if the caller may view it, checked in one batch per target type, and only for target
types where a row-dependent rule could refuse it (`RowDecisionGate`). A write never drops or
overwrites an entry its caller was not shown:
- a PATCH that touches such a list, from a caller whose view of it hides entries, is applied to
  the list as the caller was shown it, and the list is written whole with the hidden entries added
  back, so an index means what the caller saw;
- a PUT adds the stored entries the caller may not view to the list it sends.

## Consequences
Lists of references can be shorter than what is stored. A caller cannot remove an entry it may not
view; a team that may have only one parent cannot be moved by a caller who cannot see its current
parent. Such a PATCH or PUT costs one more load of the stored lists. A new reference-list field
that points at policy-protected entities is added to its resource's list.
