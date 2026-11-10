# Reasoning jobs name ontology releases, upload a checked release, and carry their rules inline

- **Status:** Accepted
- **Revisions:** v1 2026-11-10 (initial)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `RdfReasoningContractTest#theContractRejects`,
  `RdfReasoningContractTest#aRefreshMayListNoActiveRelease`, `ReasoningFreshnessTest`; in
  open-metadata/jena, `JobRequestTest` once the store's contract copy is refreshed
- **Related:** ADR:2026-10-11-rdf-reasoning-job-requests-carry-the-fields-their-operation-needs,
  ADR:2026-10-15-fuseki-holds-only-the-active-ontology-release,
  ADR:2026-10-14-ontology-releases-seal-canonical-sql-members,
  [open-metadata/jena#7](https://github.com/open-metadata/jena/pull/7),
  [open-metadata/jena#8](https://github.com/open-metadata/jena/pull/8)

## Context

The reasoning protocol (#34975) described ontology input as an `ontologySelection` of APPROVED or
CANDIDATE axioms, an `ontologyIri` naming the root of an import closure, and an opaque
`ontologyDigest`. That fitted ontologies projected from glossaries, with per-axiom approval. Native
ontologies replaced that model: OpenMetadata seals an ontology's members into an immutable release,
reviews and activates the whole release, imports between ontologies are deferred, and Fuseki holds
only the active release of each ontology, as the graph
`https://open-metadata.org/graph/ontology/{ontologyId}` whose header states
`owl:versionIRI <urn:openmetadata:ontology-release:{releaseId}>`. A draft therefore has no
representation in Fuseki to select, and nothing publishes a rule bundle there for the store to find.

## Decision

- **Identity.** Ontology input is a list `ontologyReleases` of `{ontologyId, releaseId,
  contentDigest}`, where `contentDigest` is the release's own sealed-manifest digest. Every request
  carries it, and every job and snapshot records it. `ontologySelection`, `ontologyIri` and
  `ontologyDigest` are removed.
- **REFRESH** lists every active release, possibly none, and carries `rules` inline from
  OpenMetadata's rule store together with `ruleBundleDigest`. It takes no `releaseRdf`. The store
  reads each listed release's graph from the serving dataset and fails the job with
  `INPUT_CHANGED` when a listed graph is missing or its `owl:versionIRI` names another release;
  OpenMetadata reads the active releases again and resubmits. The catalog the rules read excludes
  every graph under `graph/ontology/`, so an unlisted ontology never reaches the rules.
- **CHECK and EXPLAIN** name exactly one release, active or not, and carry `releaseRdf`:
  `{digest, byteSize, mediaType}` of RDF that OpenMetadata uploaded first with
  `PUT /reasoning/inputs/sha256:{hex}`. The upload is RDF-Thrift of the release's export, which keeps
  each statement's source member, so an explanation can name the members behind it. The store
  refuses an upload over `maxUploadBytes` or whose bytes do not hash to the path, accepts the same
  bytes again as a no-op, counts held uploads against `maxDiskBytes`, and fails a job whose upload it
  no longer holds with `INPUT_CHANGED`. An available CHECK or EXPLAIN requires the store to report
  `maxUploadBytes`.
- **Freshness.** A result stays `CURRENT` only while the set of active releases equals the set it
  recorded, in addition to the generation, watermark and rule-digest conditions.

## Consequences

A release under review can be checked without entering the serving graph, so Fuseki keeps holding
only active releases. The request stays JSON with no file inside it; the upload is a separate,
idempotent, content-addressed call. OpenMetadata's rule store stays the only copy of the rules,
at the cost of sending them with every refresh (at most 256). The release's `logicalCheck` gains
values only in the change that records a CHECK's outcome on it, so no value exists that nothing
sets. Imports between ontologies, once supported, would add the imported releases to a CHECK's
upload or list, not restore closure IRIs.
