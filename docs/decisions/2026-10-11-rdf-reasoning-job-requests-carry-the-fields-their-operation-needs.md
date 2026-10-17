# RDF reasoning job requests carry the fields their operation needs, enforced by the schema

- **Status:** Accepted
- **Revisions:** v1 2026-10-11 (initial) · v2 2026-10-14 (a new operation is also listed in
  capabilities)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `RdfReasoningContractTest#theContractRejects` and
  `RdfReasoningContractTest#aConsistencyCheckTakesNoExpression`; in open-metadata/jena,
  `JobRequestTest` runs the same cases against the store's validator
- **Related:** [#35198](https://github.com/open-metadata/OpenMetadata/issues/35198),
  [#35199](https://github.com/open-metadata/OpenMetadata/pull/35199),
  [open-metadata/jena#2](https://github.com/open-metadata/jena/pull/2),
  `openmetadata-spec/src/main/resources/json/schema/api/rdf/rdfReasoningJobRequest.json`

## Context

`rdfReasoningJobRequest.json` is the contract between OpenMetadata, which submits reasoning jobs,
and the RDF store's job API in the `openmetadata/fuseki` image, which validates them without
OpenMetadata's jars. Which fields each operation needs was stated only in field descriptions, so a
store validating against the schema accepted a CHECK without `check` or a REFRESH without
`ruleBundleDigest`.

## Decision

The schema enforces the per-operation fields with draft 2020-12 `allOf` / `if` / `then`:

- `REFRESH` requires `ruleBundleDigest`.
- `CHECK` requires `ontologyIri` and `check`; `EXPLAIN` requires `ontologyIri` and `explain`.
- A check of kind `SATISFIABILITY` requires `classExpression`; `SUBSUMPTION` requires
  `classExpression` and `superClassExpression`; `ENTAILMENT` requires `statement`;
  `CONSISTENCY` takes no expression.

The rules only add validation: the generated Java and TypeScript models do not change, so both
sides keep reading the same shape.

## Consequences

Every producer and consumer of the request follows the same rules, and a request that breaks one
fails validation on either side instead of reaching an engine. A new operation or check kind must
add its rule here and to the schema in the same change, and the store's copy of the schema
(`openmetadata/fuseki/extension/src/test/resources/openmetadata-contract/` in open-metadata/jena)
must be refreshed.

## Amendment

v2 2026-10-14: capabilities now say which operations a store implements and which limits each
needs (ADR:2026-10-14-rdf-reasoning-capabilities-list-each-operation-and-the-limits-it-enforces).
A new job operation therefore also adds its value to the capabilities `operation` enum and its
required limits to `rdfReasoningCapabilities.json` in the same change.
