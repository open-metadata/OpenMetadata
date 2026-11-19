# A relationship-type reference carries its name, and readers resolve it to a live type

- **Status:** Accepted
- **Revisions:** v1 2026-11-19 (initial)
- **Deciders:** Ontology / Governance
- **Guard:** `RelationshipTypeInverseReferenceIT`, `RelationshipTypeResolverTest`,
  `RelationshipTypeReferenceNamesTest`, `RdfGlossaryTermRelationTest`
- **Related:** #38113, #38112, #38042

## Context

A relationship type holds references to other relationship types: `inverse`, `replacedBy`,
`propertyChain[]` and `disjointWith[]`. The REST API takes them as FQN strings, and the server
stored them as `{type, fullyQualifiedName}` plus the `id` once resolved, with no `name`. The legacy
settings sync, the symmetric self-default and the RDF importer store named references, and the
readers were written against those: `RelationshipTypeResolver.inverseName` read `getName()`. For a
pair created over REST, as the UI creates it, the inverse was therefore never applied: the far end
of an edge read the forward type, an edge authored from the higher-id term was stored under the
forward type in the wrong direction, and removing an edge sent `null` to `findEntityByName` from the
RDF live writer, which then retried that write at the head of the durable queue until it was
dead-lettered and left the projection `DEGRADED`.

## Decision

- **Shape.** A stored or returned reference from one relationship type to another carries `type`,
  `fullyQualifiedName` and `name`, and its `id` once the target exists. A relationship type's FQN
  is its name (`RelationshipTypeRepository.prepare`), so the name is derived from the FQN when it
  is missing (`RelationshipTypeReferenceNames`).
- **Write.** `RelationshipTypeRepository.prepare` completes every reference on create, PUT and
  PATCH: id, name and FQN from the target when it exists (deleted or not), else the name from the
  FQN. A reference that already has an id is still completed.
- **Read.** Rows stored before this record are healed on read, not by a migration:
  `RelationshipTypeRepository.setFields`/`setFieldsInBulk` and every `RelationshipTypeResolver`
  read return named references. Relationship-type entities exist only on unreleased builds, and the
  name is derivable from the FQN at no cost.
- **Server readers resolve, never trust, a reference.** `RelationshipTypeResolver.inverseOf`
  resolves an inverse to a live type by id, then by name. An inverse that names no live type reads
  as no inverse, so a term read never fails on it and an RDF delete never becomes a poison write.

## Consequences

- The UI and API clients can read `inverse.name` for every type, whichever way it was written.
- Glossary-term relation rows written for a REST-paired type from the higher-id term before this
  change were stored under the forward type in the wrong direction. A stored row cannot tell that
  case from an edge authored as the inverse type and stored correctly, so they are not repaired;
  after the upgrade they read flipped from both ends, and removing and re-adding the edge fixes
  one. Revisit with a migration only if a released line ever shipped relationship-type entities.
- A dangling inverse (named by FQN before its target exists, or pointing at a deleted type) is
  ignored by readers instead of failing them; the type's own `inverse` still shows it.
