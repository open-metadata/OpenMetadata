# RDF reasoning capabilities list each operation and the limits the store enforces, and an unimplemented operation fails NOT_IMPLEMENTED

- **Status:** Accepted
- **Revisions:** v1 2026-10-14 (initial)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `RdfReasoningContractTest#theContractRejects` (the capabilities cases),
  `RdfReasoningContractTest#aStoreListsOnlyTheLimitsItEnforces` and
  `RdfReasoningContractTest#anOperationNeedsOnlyItsOwnLimits`; in open-metadata/jena,
  `JobServiceTest` checks the store's capabilities and job problems against the copied schemas
- **Related:** [open-metadata/jena#2](https://github.com/open-metadata/jena/pull/2),
  ADR:2026-10-11-rdf-reasoning-job-requests-carry-the-fields-their-operation-needs,
  `openmetadata-spec/src/main/resources/json/schema/api/rdf/rdfReasoningCapabilities.json`,
  `openmetadata-spec/src/main/resources/json/schema/api/rdf/rdfReasoningJob.json`,
  `docs/plans/2026-10-07-fuseki-native-reasoning.md` (Resource and latency contract)

## Context

The first store build of the `/reasoning` API (open-metadata/jena#2) serves capabilities and
accepts jobs, but cannot yet capture input, return results or run snapshot queries. Building it
against the protocol exposed three gaps:

1. `rdfReasoningCapabilities.json` said whether reasoning may run now (`readiness`) but not which
   operations the build implements. A client could not tell a store that will never answer a
   `CHECK` from one whose `CHECK` failed.
2. The problem codes had no value for "this build cannot do that". The store reported
   `NOT_READY` with a message prefix, which tells a client to retry later — retrying cannot
   succeed until the store is upgraded.
3. The `limits` description said the store reports `NOT_READY` when a limit is unset, and the
   plan said missing required limits fail capability readiness. A store computes readiness from
   its memory budget and lists only the limits it enforces; a build that implements no operation
   yet enforces only the queue and disk limits. Under the old wording it could never be `READY`,
   so readiness would stop meaning "the memory budget fits".

## Decision

- **`operations`** in capabilities: at most one `{operation, availability, reason}` entry per
  operation (schema `maxContains: 1`). `operation` is `REFRESH`, `CHECK`, `EXPLAIN` (the job
  operations), `RESULTS` (`GET /reasoning/results/{id}`) or `QUERY` (`POST /reasoning/query`).
  `availability` is `AVAILABLE` or `NOT_IMPLEMENTED`. An operation that is not listed, and every
  operation when the list is absent, is `NOT_IMPLEMENTED`, so a store that predates the field
  reads as implementing nothing.
- **`NOT_IMPLEMENTED`** problem code: the store's build cannot perform the operation or one of
  its steps. It is permanent for that build; `NOT_READY` stays transient (disabled, memory budget,
  stopping, disk unmeasurable). `NOT_IMPLEMENTED` was chosen over `UNSUPPORTED_OPERATION` because
  it names the cause (missing code, not a refused request), matches the HTTP `501 Not Implemented`
  the store already answers for results and queries and the `NOT_IMPLEMENTED` error type OM's own
  REST layer uses, and does not read as an unsupported OWL construct, which is
  `PROFILE_VIOLATION` or a coverage gap.
- **Limits are mandatory per operation, not for readiness.** `limits` lists exactly the limits the
  store enforces; an absent limit is not enforced. The store reports an operation `AVAILABLE` only
  when it enforces every limit that operation needs, and the schema rejects capabilities that
  break this (`allOf` / `if` / `then`):

  | Operation `AVAILABLE` | Required limits |
  |---|---|
  | `REFRESH`, `CHECK` or `EXPLAIN` | `maxQueuedJobs`, `maxJobSeconds`, `maxDiskBytes`, `maxClosureAxioms`, `maxIndividuals`, `maxExpressionDepth`, `maxImports` |
  | `REFRESH` | also `maxDerivedTriples`, `maxRulePasses` |
  | `RESULTS` or `QUERY` | `maxResultRows` |
  | `QUERY` | also `maxQuerySeconds` |

  Readiness depends only on whether the store may admit work now. A client needs both: an
  operation runs when readiness is `READY` and the operation is `AVAILABLE`.

The fields are additive: protocol version stays `1`, and the generated models gain the
`operations` list, its two enums and one problem-code value, nothing else.

## Consequences

OpenMetadata can disable a feature whose operation is `NOT_IMPLEMENTED` instead of submitting
work that fails, and can stop retrying on `NOT_IMPLEMENTED` while it keeps retrying on
`NOT_READY`. A store cannot advertise an operation without the limits that bound it, which keeps
the plan's "mandatory limits" rule checkable from one document. A new operation must add its enum
value, its row in the table above and its schema rule in the same change, and the store's copy of
the schemas (`openmetadata/fuseki/extension/src/test/resources/openmetadata-contract/` in
open-metadata/jena) must be refreshed. Revisit if an operation can run with a limit unenforced
safely, or if a store needs per-engine rather than per-operation availability.
