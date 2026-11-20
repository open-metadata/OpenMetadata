# A relationship type in use cannot be deleted

- **Status:** Accepted
- **Revisions:** v1 2026-11-18 (initial) · v2 2026-11-19 (the link back on restore is the canonical named reference; references match by id or FQN)
- **Deciders:** Ontology Studio team
- **Guard:** `RelationshipTypeDeleteGuardIT`, `GlossaryRdfImportIT`, `RelationshipTypeReferencesTest`, `RelationshipTypeRdfWriterTest`, `LegacyRelationshipTypeSynchronizerTest`
- **Related:** #38112, ADR:2026-11-17-recreating-a-deleted-ontology-name-restores-its-record

## Context
Other relationship types name a type as their `inverse`, `replacedBy`, a `propertyChain` member or
a `disjointWith` member, and glossary term relations store the type by name and id. Relations are
stored from the lower term id, so one authored as `A` from the higher id is stored as `A`'s
inverse. Every reader resolves these against live types, so deleting a type in use made term reads,
lists, edits and the ontology export of the affected glossaries fail with 400. Only system types
were protected from deletion.

## Decision
1. A soft or hard delete of a relationship type is rejected with 400 while another type, live or
   soft-deleted, names it in `replacedBy`, `propertyChain` or `disjointWith` (matched by id, FQN or
   name, its own references excluded), or while any stored glossary term relation, including those
   of soft-deleted terms, is stored as it. The message names those types and counts the relations.
2. Another type naming it as its `inverse` does not block the delete: the delete clears each live
   partner's `inverse` in the same transaction, as a versioned change of the partner by the
   deleting user with its own change event. The partner is written only if it is unchanged since
   the delete read it; otherwise the delete fails with 412 and nothing is written. The delete is
   still rejected while a relation is stored as such a partner: relations are stored from the lower
   term id, so one authored as the deleted type from the higher id is stored as the partner, and
   every relation stored as the partner reads as the deleted type from its other end. Clearing the
   inverse would make those read as the partner at both ends, so only a pair with no relation stored
   as either side loses a side. A soft-deleted partner keeps its back-link; it holds no relation.
3. A restored type keeps its `inverse` only as one half of a pair. A live partner with no inverse and
   no stored relation is linked back, under the same unchanged-since-read condition; otherwise the
   restored type's inverse is cleared. A one-way link would read a relation authored as the restored
   type from the higher term id back as the partner. The restored type holds no relation (it could
   not be deleted with one or gain one while deleted), so clearing its inverse changes no reading,
   while re-linking a used partner would change how the partner's relations read. The link back
   takes the shape of the restored type's own inverse reference (with or without a name), the shape
   the pair was written in. Only a deleted type can be restored; restoring a live one is rejected
   with 400 before anything is written.
4. A create or update whose references name a soft-deleted type is rejected with 400. A reference
   by FQN to a type that does not exist yet stays allowed (the UI creates an inverse pair that
   way); the ontology export omits such an axiom instead of failing. An RDF import that names the
   predicate of a soft-deleted type restores that type first, and skips a new type whose name a
   soft-deleted type holds on another predicate
   (ADR:2026-11-18-rdf-import-registers-governed-inverse-components). A term relation naming a
   soft-deleted type is rejected with the same "is deleted; restore it first" message.
5. The deprecated settings write removes several types at once: the whole removal is checked before
   the setting is saved, against the definitions that write saves, and references among the removed
   types do not block it, whether they hold them by id or by FQN alone. A kept type's inverse naming
   a removed type is cleared as in rule 2. A listed type that is soft-deleted is brought back before
   the others. The removal runs in one transaction, so a delete refused by a concurrent change
   leaves every type in place rather than a partial removal; the setting itself is saved first.
6. Dependents are never cascaded: relations are never deleted or retyped, and an `inverse` is cleared
   only when no relation reads through it.
7. No repair ships for types deleted earlier: that was possible only on unreleased 2.1/main builds
   and the 2.1.0 pre-releases, and restoring the type (soft delete) or recreating it under the same
   name, with its inverse, through the API (hard delete) makes those reads work again.

## Consequences
Reads stay consistent without tolerant fallbacks. Deleting one side of an unused inverse pair just
works and leaves the other side without an inverse; relations added to it afterwards are stored and
read as that type at both ends, like any type without an inverse. Restoring the deleted side links
the pair again while the other side is still unused. When both sides were deleted, restoring the one
deleted last first and then the other rebuilds the pair; the other order leaves both without an
inverse. To delete a type that relations or other definitions use, an admin first removes them.

A relation write and a type delete are each validated on their own, not locked against each other.
Any glossary editor writing relations can race an admin's delete for as long as the writer's
transaction is open: a relation stored as the type (or as a partner whose inverse the delete
clears) after the delete counted relations commits next to a deleted type. The outcome is the
original failure for that glossary: its term reads, list, edits and ontology export fail with 400
until the type is restored (soft delete) or recreated under its name (hard delete). MySQL compares
type names in binary after converting the stored name to utf8mb4, since the column takes the
database character set.

## Amendment

**v2, 2026-11-19.** Relationship-type references now carry their name, and every writer stores one
shape (ADR:2026-11-19-relationship-type-references-carry-their-name). Two parts of decision 3 change:

- **The link back on restore** is that canonical reference: id, type, name, FQN, displayName and
  description. It no longer copies the restored type's own inverse shape. That copy existed because
  the inverse was applied by name, and a named link on one side only would have read relations
  differently. Readers now resolve the inverse by id, then by name.
- **Matching a reference to a type** (`RelationshipTypeReferences.refersTo`) is by id, else by FQN.
  The separate name match is gone. Every path that feeds it reads references through
  `RelationshipTypeReferenceNames`, which gives a reference stored with only a name its FQN. This
  includes the guard's raw reads: `listIncludingDeleted`, the referenced-type lookup and the
  restored type's inverse.
