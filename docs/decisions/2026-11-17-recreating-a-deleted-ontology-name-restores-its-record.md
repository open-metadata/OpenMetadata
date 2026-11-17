# Creating an ontology definition under a soft-deleted name restores that record

- **Status:** Accepted
- **Revisions:** v1 2026-11-17 (initial)
- **Deciders:** Ontology Studio team
- **Guard:** `BaseOntologyIT.recreatingASoftDeletedNameRestoresTheSameDefinitionWithTheNewValues`, `OntologyRecreateDeletedIT`, `OntologyAxiomResourceIT.deletedRuleIsRestoredByUndoOrByStatingItAgain`
- **Related:** 2.1 Ontology Studio release testing

## Context
Ontologies, concepts, properties and rules are soft-deleted, and the unique `fqnHash` includes
deleted rows. Re-adding a deleted relationship or re-creating a deleted ontology therefore failed
with 409, and Studio has no way to restore a deleted ontology, so its name was lost. Purging the
deleted row on create was rejected: Studio's Undo restores the deleted id, and a purge would make
that Undo fail and lose history.

## Decision
A create (POST, or a change-set `UPSERT_*`) whose name is held only by a soft-deleted definition
restores that row — same id, `deleted=false` — and applies the request's values, as PUT does. Only
the definition itself comes back; children deleted with it stay deleted until an explicit restore.
Nothing is hard-deleted. A name held by a live definition still conflicts. The semantic IRI stays
immutable, so a re-create with a different IRI is refused. `PUT …/restore` on an id that is already
live succeeds, so an Undo issued after the name was re-created does not fail.

## Consequences
Deleted names are reusable and Undo keeps working. A re-create carries the old record's history and
id. Restoring a re-created ontology brings back its soft-deleted children as a normal restore does.
