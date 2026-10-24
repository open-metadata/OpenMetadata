# Native release validation binds SHACL targets to captured definitions

- **Status:** Accepted
- **Revisions:** v1 2026-10-23 (initial)
- **Deciders:** Harsha
- **Guard:** `NativeOntologyShapesTest`, `OntologyReleaseProjectionTest`, `OntologyReleaseValidationTest`, `IndependentOntologyReleaseValidationIT`
- **Related:** ADR:2026-10-14-ontology-definitions-have-independent-entity-storage

## Context

The release RDF projection declares referenced classes and properties, including IRIs from other ontologies. Raw SHACL shapes target every `owl:Class` or `owl:DatatypeProperty` declaration. Applying those targets unchanged to a captured release would report missing labels on referenced classes that the release does not own.

## Decision

The raw native shapes keep standard `sh:targetClass` declarations. A release validation request copies the shapes graph and replaces those targets with the captured OWL class and DATA property IRIs. The request does not change shared shapes or the export projection.

`GET /api/v1/ontologyReleases/{id}/validation` combines structure findings, native SHACL findings, and current authorized impact for definitions newly deprecated against the literal captured base. It reports `logicalCheck: NOT_RUN`. Warnings do not make the report invalid.

The server verifies and authorizes both complete release manifests on every call. It caches only serialized structure and native findings by verified content digest, with at most 256 entries and 131,072 UTF-16 code units per entry. Release IDs are restored on detached structure reports. Base comparison, captured direct dependencies, and current visible bindings are resolved on every call. Missing current concepts or ontologies retain the binding resolver's 404; authorization failures retain 403.

## Consequences

A historical validation read can return 404 after a newly deprecated current concept is deleted. The report does not turn that missing impact into an empty binding list. Cache hits still read and authorize the manifests, so the cache does not bypass access changes. Later binding pagination must drain all visible pages before setting `boundAssetCount`.
