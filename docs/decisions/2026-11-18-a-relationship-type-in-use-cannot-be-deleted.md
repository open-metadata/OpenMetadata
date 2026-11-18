# A relationship type in use cannot be deleted

- **Status:** Accepted
- **Revisions:** v1 2026-11-18 (initial)
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
   soft-deleted, references it (matched by id, FQN or name, its own references excluded) or any
   stored glossary term relation, including those of soft-deleted terms, uses it. The message
   names the referencing types and counts the relations. Counting soft-deleted referrers means a
   restore never brings back a reference to a missing type, so restore needs no check of its own.
2. A create or update whose references name a soft-deleted type is rejected with 400. A reference
   by FQN to a type that does not exist yet stays allowed (the UI creates an inverse pair that
   way); the ontology export omits such an axiom instead of failing. An RDF import that names a
   soft-deleted type restores it under its stored id before writing the types that reference it.
3. The deprecated settings write removes several types at once: the whole removal is checked before
   the setting is saved, against the definitions that write saves, and references among the removed
   types do not block it. A listed type that is soft-deleted is brought back before the others.
4. Dependents are never cascaded: deleting or retyping relations, or clearing an `inverse`, would
   drop or silently reinterpret what users stored.
5. No repair ships for types deleted earlier: that was possible only on unreleased 2.1/main builds
   and the 2.1.0 pre-releases, and restoring the type (soft delete) or recreating it under the same
   name, with its inverse, through the API (hard delete) makes those reads work again.

## Consequences
Reads stay consistent without tolerant fallbacks. To delete a type, an admin first removes the
relations and the references to it; a mutual inverse pair needs one side's `inverse` cleared first
(the deprecated settings write removes a pair in one call). A concurrent relation write and type
delete are each validated on their own, not locked against each other.
