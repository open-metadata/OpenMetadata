# A relationship type in use cannot be deleted, and the upgrade restores the ones that were

- **Status:** Accepted
- **Revisions:** v1 2026-11-18 (initial)
- **Deciders:** Ontology Studio team
- **Guard:** `RelationshipTypeDeleteGuardIT`, `RelationshipTypeReferenceRepairMigrationIT`, `RelationshipTypeReferencesTest`, `RelationshipTypeRepairPlannerTest`
- **Related:** #38112, ADR:2026-11-17-recreating-a-deleted-ontology-name-restores-its-record

## Context
Other relationship types name a type as their `inverse`, `replacedBy`, a `propertyChain` member or
a `disjointWith` member, and glossary term relations store the type by name and id. Relations are
stored from the lower term id, so one authored as `A` from the higher id is stored as `A`'s
inverse. Every reader resolves these against live types, so deleting a type in use made reads,
lists, edits and the ontology export of the affected terms fail with 400. Only system types were
protected from deletion.

## Decision
1. A soft or hard delete of a relationship type is rejected with 400 while another type, live or
   soft-deleted, references it (matched by id, FQN or name, its own references excluded) or any
   stored glossary term relation, including those of soft-deleted terms, uses it. The message
   names the referencing types and counts the relations. Counting soft-deleted referrers means a
   restore never brings back a reference to a missing type, so restore needs no check of its own.
2. Dependents are never cascaded: deleting or retyping relations, or clearing an `inverse`, would
   drop or silently reinterpret what users stored.
3. The 2.1.0 data migration (`RelationshipTypeReferenceRepair`, run once) puts existing installs in
   the state rule 1 would have left them: a soft-deleted type still in use is undeleted, and a
   hard-deleted one is recreated under its old id and name as a deprecated custom placeholder whose
   description says why; when a type names it as `inverse`, the placeholder names that type back.
   References written before their target existed carry no id and are left alone.

## Consequences
Reads stay consistent without tolerant fallbacks. To delete a type, an admin first removes the
relations and the references to it; a mutual inverse pair needs one side's `inverse` cleared first.
A placeholder's original predicate and semantics are lost and must be redefined or the type deleted
once unused. Search and RDF projections of repaired types refresh on the next reindex. A concurrent
relation write and type delete are each validated on their own, not locked against each other.
