# Glossaries do not own ontology models

- **Status:** Accepted
- **Revisions:** v1 2026-10-17 (initial)
- **Deciders:** Harsha
- **Guard:** `GlossaryModelBoundaryTest`, `GlossaryOntologyCleanupMigrationTest`, glossary relation integration tests, reviewer
- **Related:** #35672, ADR:2026-10-14-ontology-definitions-have-independent-entity-storage

## Context

Native ontology entities were introduced alongside an unreleased glossary-based modeling path.
Keeping both makes it unclear where users should author an ontology. Glossary terms must retain
their released business vocabulary and configurable relationships without becoming a second
ontology model.

## Decision

Remove the unreleased `attributes`, `effectiveAttributes`, `realizedIn`, `conceptType`,
`ontologySource` and `sourceMemoryIds` fields from glossary terms, and `ontologyConfiguration`
from glossaries. Ontology definitions belong to native ontologies. Memory provenance for native
definitions continues to use change-set operations and `DERIVED_FROM` relationships.

Preserve released glossary behavior. The available `2.0.5-release` baseline already includes term
IRIs, external concept mappings, glossary namespaces and RDF import; these are compatibility
features, not permission to reintroduce native ontology authoring on glossaries. Configurable term
relations, their existing data, the Relations Graph, tagging and glossary approval workflows remain.

Regenerate clients from the schemas and update callers together. Remove the retired fields from
development entity JSON and version history before the new server deserializes them. Do not
convert existing glossaries or glossary terms into native ontology entities. Incompatible development
change sets and their history are reset; compatible glossary drafts and all native drafts remain.
Development installations must rebuild search and RDF indexes after the migration to remove the
retired fields and projections from those stores.

Glossary RDF projects a SKOS vocabulary, without treating every term or parent as an OWL class
or subclass. Released RDF import still supports ordinary custom properties with its existing
permission check. Native releases remain the source of authored OWL properties and axioms.

## Consequences

Clients cannot use glossary payloads to author native properties, class kinds or ontology layers.
Ontology Studio must use native definitions for ontology modeling. Changes to the remaining
glossary-based AI and modeling consumers must respect this boundary rather than retaining hidden
copies of the removed fields.

The glossary IRI-preview, subset and structural-merge endpoints are retired with their UI and SDK
entry points. Library RDF import remains available as vocabulary import, without storing ontology
installation configuration on a glossary. Native equivalents of these authoring tools are separate
work; this change does not add them. Ordinary glossary AI drafts can still propose vocabulary terms,
relations and external mappings, with evidence on the change set rather than new fields on terms.

This revises the glossary class/property projection described in
ADR:2026-10-11-glossary-ontology-projection-is-owl2-dl-with-one-class-iri-rule and
ADR:2026-10-11-glossary-dates-are-xsd-datetime-and-skos-parents-are-not-superclasses.
