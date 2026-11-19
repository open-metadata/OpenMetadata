# A relationship-type reference carries its name; reads tolerate a missing target, writes do not

- **Status:** Accepted
- **Revisions:** v1 2026-11-19 (initial)
- **Deciders:** Ontology / Governance
- **Guard:** `RelationshipTypeInverseReferenceIT`, `RelationshipTypeResolverTest`,
  `RelationshipTypeReferenceNamesTest`, `RdfGlossaryTermRelationTest`
- **Related:** #38113, #38112 (PR #38140), #38042 (PR #38147)

## Context

A relationship type holds references to other relationship types: `inverse`, `replacedBy`,
`propertyChain[]` and `disjointWith[]`. The REST API takes them as FQN strings.

The server stored them as `{type, fullyQualifiedName}` plus the `id`, with no `name`. That covers
pairs created through the UI, and also seeded pairs such as `broader`/`narrower` once they are saved
from the Settings page. The legacy settings sync, the symmetric self-default and the RDF importer
store named references, and the readers were written against those:
`RelationshipTypeResolver.inverseName` read `getName()`.

For a name-less pair the inverse was never applied:

- The far end of an edge read the forward type.
- An edge authored from the higher-id term was stored under the forward type in the wrong direction.
- Removing an edge sent `null` to `findEntityByName` from the RDF live writer. The writer retried
  that write at the head of the durable queue for about four minutes, then dead-lettered it. The
  projection stayed `DEGRADED` until a reindex, and the removed triple stayed in Fuseki.

The bug is on `main`, `origin/2.1` and the 2.1.0 release candidates. No GA release has shipped
relationship-type entities.

## Decision

- **Shape.** Every writer stores one shape for a reference to an existing type,
  `RelationshipTypeReferenceNames.referenceTo`: `id`, `type`, `name`, `fullyQualifiedName`,
  `displayName`, `description`. A reference to a type that does not exist yet carries `type`,
  `fullyQualifiedName` and `name`. A relationship type's FQN is its quoted name, so the name is
  `unquoteName(fqn)` and a lookup by name uses `quoteName(name)`.
- **Write.** `RelationshipTypeRepository.prepare` completes every reference on create, PUT and PATCH,
  deleted target or not. A reference whose `id`, `name` and `fullyQualifiedName` name different
  types is refused with 400 rather than resolved by one of them.
- **Read.** Rows stored before this record are healed on read, not by a migration: the name is
  derived from the FQN at no cost. The heal applies in `RelationshipTypeRepository.setFields` and
  `setFieldsInBulk` and in every `RelationshipTypeResolver` read. A row is rewritten the next time
  the type changes. Entity version history and already-indexed search documents keep the shape they
  were written with.
- **Reads tolerate a missing target; writes do not.** Term-relation reads (`applyInverse`, the bulk
  related-terms fetch) resolve the inverse with `RelationshipTypeResolver.inverseOf`. An inverse
  that names no live type reads as none, so a read never fails on it. The RDF delete resolves it
  with `Include.ALL`, so the triples of a soft-deleted inverse are still removed. Writes that pick a
  stored direction, delete a stored row or count cardinality use the declared inverse name. An
  inverse that is declared but not registered refuses the write, the same way a soft-deleted one
  already does. This matches the delete guard proposed in #38140, which prevents dangling references
  at write time; the read tolerance covers references written before that or by FQN before their
  target existed.

## Consequences

- The UI and API clients can read `inverse.name` for every type, whichever way it was written.
- Some glossary-term relation rows written before this change are stored in the wrong direction:
  a name-less type, an edge authored from the higher-id term. They read flipped after the upgrade.
  - A stored row cannot tell that case from an edge authored as the inverse type and stored
    correctly, so these rows are not repaired.
  - Suspects are rows of a paired type whose `sourceTermId` is the stored `toId`. For example, on
    PostgreSQL: `SELECT fromId, toId, json->>'relationType' FROM entity_relationship WHERE relation = 15
    AND json->>'sourceTermId' = toId`.
  - To fix a row, remove the edge and add it again.
  - Before the fix the same pair could also be stored twice, as `T1 A T2` and `T2 B T1`; those rows
    now read as two edges.
- Edge removals already dead-lettered on such a build leave the removed triples in Fuseki until an
  RDF reindex.
- Changing a type's `inverse` while relations of that type are stored changes how those rows read.
  That predates this record and is left to a follow-up.
