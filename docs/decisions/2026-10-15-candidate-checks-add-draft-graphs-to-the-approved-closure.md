# Candidate checks add Draft and In Review graphs to the Approved closure

- **Status:** Accepted
- **Revisions:** v1 2026-10-15 (initial)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `OntologyClosuresTest#aCandidateClosureAddsDraftGraphsWithoutChangingProduction` and
  `RdfOntologyActivationIT`
- **Related:** ADR:2026-10-15-reasoning-closures-are-approved-graphs-pinned-by-a-content-manifest,
  ADR:2026-10-11-rdf-reasoning-job-requests-carry-the-fields-their-operation-needs,
  `docs/plans/2026-10-07-fuseki-native-reasoning.md` (semantic projection item 6)

## Context

Draft and In Review changes must be checked in isolation and never feed production reasoning.
The store runs the CHECK in phase 4, reading its input from the serving dataset; the job request
(`rdfReasoningJobRequest.json`) names an `ontologyIri`, an `ontologySelection` of `APPROVED` or
`CANDIDATE`, and an `ontologyDigest`, and carries no triples. An `ontologyChangeSet` holds typed
operations that only become entities, and graphs, when it is applied.

## Decision

- `POST /v1/ontology/reasoning/closures/{glossaryId}/candidates` takes `entityId` (repeatable)
  and `changeSetId`. A change set contributes the axioms and terms its applied operations
  produced and those its active operations create or edit; relationship and mapping operations
  change no ontology graph.
- Each entity's graph joins the closure of the glossary that owns it, if that glossary is the
  root or one it imports, when its status is Draft or In Review. Every requested entity is
  reported: `INCLUDED`, `NOT_PROJECTED` (no graph, such as an unapplied operation),
  `ALREADY_APPROVED`, `NOT_A_CANDIDATE_STATUS` or `OUTSIDE_CLOSURE`. At most 10,000 entities per
  request.
- A closure with a candidate, or importing one, has selection `CANDIDATE`, its own digest and a
  version IRI ending `/candidate/{hex}`. Its manifest is published like an Approved one and marks
  candidates with `omr:candidateGraph`; it is never activated, so production is unchanged. The 32
  newest candidate manifests are kept.
- The response carries the CHECK OpenMetadata would submit: `operation CHECK`, the current
  serving `sourceRevision`, `ontologySelection CANDIDATE`, the ontology IRI, the candidate digest
  as `ontologyDigest`, and a `CONSISTENCY` check. The store finds the manifest at
  `{base}graph/manifest/{hex of ontologyDigest}`. The request ID is derived from the digest and
  revision, so a retry is the same job. No reasoning schema changed.
- Publishing requires `EditAll` on the glossary, because it writes to the store.

## Consequences

An unapplied change set cannot be checked until it is applied; applying entities that are not
Approved does not reach production. Checking a new version of an Approved entity before it is
saved would need graphs outside the serving dataset, which the store cannot read yet. Candidate
manifests and their unactivated imported manifests are visible in Fuseki's union graph like any
other control graph.
