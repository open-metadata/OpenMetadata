# A relationship-type reference carries its name; reads tolerate a missing target, writes do not

- **Status:** Accepted
- **Revisions:** v1 2026-11-19 (initial)
- **Deciders:** Ontology / Governance
- **Guard:** `RelationshipTypeInverseReferenceIT`, `RelationshipTypeResolverTest`,
  `RelationshipTypeReferenceNamesTest`, `RdfGlossaryTermRelationTest`
- **Related:** #38113, #38112, #38042, ADR:2026-11-18-a-relationship-type-in-use-cannot-be-deleted (amended v2)

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
  `RelationshipTypeReferenceNames.referenceTo`: `id`, `type`, `name`, `fullyQualifiedName`. It
  carries identity only, so it never goes stale when the target's display name or description
  changes, and re-saving a type records no spurious `inverse` change. That includes the partner link
  a restore writes back. A reference to a type that does not exist yet carries `type`,
  `fullyQualifiedName` and `name`. A relationship type's FQN is its quoted name, so a reference
  stored with only one of them gets the other: `unquoteName(fqn)` or `quoteName(name)`.
- **Write.** `RelationshipTypeRepository.prepare` completes every reference on create, PUT and PATCH,
  deleted target or not, including one given by id alone. A reference whose id, name and
  `fullyQualifiedName` name different types is refused with 400 rather than resolved by one of them;
  only the parts it carries are compared.
- **Read.** Rows stored before this record are healed on read, not by a migration: the name is
  derived from the FQN at no cost. The heal applies in `RelationshipTypeRepository.setFields` and
  `setFieldsInBulk`, in every `RelationshipTypeResolver` read and in every read of the delete
  guard. A reference therefore matches a type by id or FQN alone. A row is rewritten the next time
  the type changes. Entity version history and already-indexed search documents keep the shape they
  were written with.
- **One resolution of the inverse.** Reading a term relation, deleting one and counting relations for
  cardinality all resolve the inverse to a live type with `RelationshipTypeResolver.inverseOf`. An
  inverse that names no live type counts as none, so a relation reads and deletes the way it was
  stored. Storing a new relation of a type whose declared inverse names no live type is refused with
  400 in either direction (`requireInverseName`), since the stored direction would depend on a type
  that may appear later. The RDF delete resolves the inverse with `Include.ALL`, so the triples of a
  soft-deleted inverse are still removed. This matches
  ADR:2026-11-18-a-relationship-type-in-use-cannot-be-deleted, which prevents dangling references at
  write time; the read tolerance covers references written before that or by FQN before their
  target existed.

## Consequences

- The UI and API clients can read `inverse.name` for every type, whichever way it was written.
- Some glossary-term relation rows written before this change are stored in the wrong direction:
  a name-less type, an edge authored from the higher-id term. They read flipped after the upgrade.
  - In general a stored row cannot tell that case from an edge authored as the inverse type and
    stored correctly: a seeded pair saved from Settings had one side named and one not. For a pair
    whose inverse was name-less on both sides (a pair created through the API), every such row is
    mis-stored, so a one-time repair is possible. It is not shipped: no GA release has these
    entities.
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
