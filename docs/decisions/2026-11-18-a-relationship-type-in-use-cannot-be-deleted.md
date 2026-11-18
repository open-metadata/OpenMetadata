# A relationship type in use cannot be deleted, and the upgrade restores the ones that were

- **Status:** Accepted
- **Revisions:** v1 2026-11-18 (initial)
- **Deciders:** Ontology Studio team
- **Guard:** `RelationshipTypeDeleteGuardIT`, `RelationshipTypeReferenceRepairMigrationIT`, `RelationshipTypeReferencesTest`, `RelationshipTypeRepairPlannerTest`, `RelationshipTypeRdfWriterTest`
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
   way); the ontology export omits such an axiom instead of failing.
3. The deprecated settings write removes several types at once: the whole removal is checked before
   the setting is saved, and references among the removed types do not block it.
4. Dependents are never cascaded: deleting or retyping relations, or clearing an `inverse`, would
   drop or silently reinterpret what users stored.
5. Every 2.1.0 data migration runs `RelationshipTypeReferenceRepair`, a fixed point that puts an
   install in the state rule 1 would have left it: starting from live types and stored relations,
   a soft-deleted type still in use is undeleted (and what it references, in turn), and a
   hard-deleted one is recreated under its old id and name as a deprecated custom placeholder whose
   description says why. When a type names it as `inverse`, the placeholder names that type back
   in the same shape, named or not, so relations read as before. A soft-deleted type only other
   soft-deleted types use stays deleted. References without an id are never recreated.

## Consequences
Reads stay consistent without tolerant fallbacks. To delete a type, an admin first removes the
relations and the references to it; a mutual inverse pair needs one side's `inverse` cleared first
(the deprecated settings write removes a pair in one call). A placeholder's original predicate and
semantics are lost and must be redefined or the type deleted once unused; RDF triples written under
the old predicate stay until the RDF store is rebuilt, and search shows repaired types after the
next reindex. A concurrent relation write and type delete are each validated on their own, not
locked against each other.
