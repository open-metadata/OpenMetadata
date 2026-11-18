# Saved failed-row samples retain classification at column removal

- **Status:** Accepted
- **Revisions:** v1 2026-11-18 (initial)
- **Deciders:** Accepted issue #37485 implementation plan
- **Guard:** FailedRowsSamplePolicyTest and TestCaseResourceIT
- **Related:** #37485; ADR:2026-10-09-bulk-edits-compose-single-entity-writes

## Context

Failed-row values outlive their source columns. Reading them using only current tags can expose a
sensitive value after its column disappears. Freezing sensitivity at upload would prevent an
explicit declassification from taking effect. Query results also include useful outputs such as
`extra_column` and `diffType` that have no table column.

## Decision

Store a private versioned sample envelope in the existing sample extension. It co-locates the
original TableData, table UUID, observed removal sequence and positional source associations.
Additional outputs keep existing masking behavior. Columns use current classification while live;
the first relevant removal after binding preserves the last committed classification. A combined
untag/removal uses the state preceding that request. A removed sensitive nested child conservatively
masks its sampled parent, without capturing sensitivity from unrelated surviving siblings.

Keep immutable normalized removal facts in a table extension. Capture before generic table-tag and
column-tag mutation, in the canonical entity transaction. Synthetic consolidation passes do not
append events, and transaction retries rebuild request-local state. Sample save/read and table
mutation coordinate on the stable table row and read authoritative state after locking. Reject a
stale removal baseline instead of capturing facts for metadata the request did not observe. Bulk
removals use canonical per-entity writes, preserving request order for repeated table names.

Retain at most 1,000 path facts and 1 MiB of serialized UTF-8 record data per table. Both limits bound
path and representation overhead; prune complete oldest batches and advance a coverage watermark.
An oversized batch advances that watermark without retaining partial facts. Incomplete coverage
masks identified source positions conservatively; it does not newly mask additional outputs.

The new reader accepts legacy raw TableData and applies current policy plus matching retained
sensitive removal evidence. Malformed or unsupported envelopes fail closed. Upgrade backend nodes
together: old server binaries cannot read the new private envelope. Public APIs and producers retain
the TableData contract; deployment must not serve newly written samples through older binaries.

## Consequences

Authorized reads preserve originals, and ordinary plain or explicitly declassified removals remain
readable. Storage and update work stay table-local, with no sample scan. Retained evidence cannot
reconstruct pre-deployment removals. Legacy matching can overmask colliding labels. This association
does not establish arbitrary SQL provenance, delayed-upload identity across replacement, exact
repeated nested generations, or global ordering with independent glossary/tag/data-model writers.
Those guarantees require a broader producer/catalog protocol.
