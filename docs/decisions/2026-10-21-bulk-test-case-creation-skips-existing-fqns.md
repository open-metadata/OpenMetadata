# Bulk test-case creation skips existing fully qualified names

- **Status:** Accepted
- **Revisions:** v1 2026-10-21 (initial), v2 2026-10-21 (shared bulk-create recovery), v3 2026-10-21 (preparation races), v4 2026-10-21 (per-input outcomes and conflict policy), v5 2026-10-21 (SDK defaults and retry behavior)
- **Deciders:** Harsha
- **Guard:** `TestCaseResourceIT`, `GlossaryTermResourceIT`, `EntityBulkCreateRecoveryIT`, `BulkCreateFluentAPITest`, `ingestion/tests/unit/sdk/test_bulk_create.py`
- **Related:** `POST /api/v1/dataQuality/testCases/createMany`

## Context

Automated test creation can submit an already existing test alongside new tests. A duplicate FQN
previously rejected the entire batch, preventing the new tests from being created.

## Decision

The bulk test-case endpoint skips existing FQNs, including soft-deleted tests, without updating or
restoring them. Repeated FQNs within a request use the first occurrence. The response contains only
newly created tests, in request order, and is empty when every test is skipped.

The existing request size limit of 100 keeps the inserts in one transaction. If a concurrent request
wins an insert, the failed transaction rolls back before a fresh lookup removes the winner and
retries the remaining tests. Each retry must remove at least one conflicting FQN, bounding retries
by the request size. Other errors, or duplicate-key errors without a matching existing FQN, propagate.

## Consequences

Callers can safely repeat bulk creation without overwriting existing tests. They must use the
returned FQNs rather than assume one result per submitted item. Skipped tests receive no new
relationships or creation events. Single-test creation and other entities keep their existing behavior.

## Amendment v2: shared bulk-create recovery

`EntityRepository.createMany` now owns this behavior for every caller, including glossary terms.
Entity-specific validation still runs for all new entries before any writes. FQN lookup precedes
validation because some repositories reject existing names during preparation rather than at INSERT.
Glossary rules for conflicting names under different parents remain validation errors.

Recovery is limited to the failed transaction's chunk of at most 100 entities. Each successful chunk
finishes its creation hooks before the next chunk starts, so a later failure neither replays committed
rows nor leaves them without search indexing and creation events. Concurrent duplicates are skipped
after rollback with a warning, and only the remaining new entries in that chunk are retried. Recovery
requires a matching FQN with a different stored ID; an unrelated unique constraint or a failure after
our own rows committed still propagates. Previously committed chunks remain committed on other errors.

This supersedes the v1 limitation to test cases. Single-entity creation and bulk create-or-update
retain their existing contracts; updates are not converted into skips. API responses still contain
only newly created entities, so clients must not assume one result per submitted item.

## Amendment v3: concurrent creation during preparation

A concurrent request can create an FQN after the initial lookup but before validation. When
preparation rejects an entry, recovery rechecks that exact FQN and skips it only if another ID now
exists. Otherwise, the original validation error propagates before any batch writes. This preserves
glossary name validation for different parents, whose FQNs differ even when their names match.

## Amendment v4: explicit outcomes and request conflict policy

Both test-case and glossary-term `createMany` endpoints return a `BulkCreateResult` when the
request explicitly supplies `onConflict=skip` or `onConflict=fail`. Omitting the parameter preserves
the created-entity array and rejects validation errors before writes, as existing clients expect. The response contains `createdCount`, `skippedCount`, `failedCount`, and one result per
input in request order. Each result includes its zero-based input index, FQN when it can be resolved,
and `created`, `skipped`, or `failed` status. Skipped and failed results include a stable reason code
and a readable message. An ID is returned only for a newly created entity. Conflict results do not expose stored IDs
because permission to create does not imply permission to read the existing entity.

The `onConflict` query parameter accepts `skip` or `fail`. Legacy requests skip conflicts. It applies to existing FQNs,
including soft-deleted entities, repeated FQNs in the request, and concurrent winners during
preparation or insertion. `fail` marks the conflicting input as failed and continues with other
valid inputs; it does not mean all-or-nothing request execution. Both policies preserve existing
entities. Repeated new names use the first valid occurrence. An input that fails mapping or preparation
does not reserve its FQN; a later valid occurrence can be created.

With an explicit policy, entity mapping and preparation validation failures are reported per input as `VALIDATION_ERROR`;
valid inputs continue. Conflicts use `ALREADY_EXISTS` or `DUPLICATE_IN_REQUEST`. Authentication,
authorization, malformed requests, request limits, and unexpected storage or post-commit failures
remain HTTP errors. Those errors may occur after earlier transaction chunks committed, as in v2;
the API does not promise request-wide atomicity or reinterpret infrastructure errors as skips.

The Java SDK keeps its existing `createMany(requests)` list return type and adds an explicit-policy
overload returning the detailed result. This preserves Collate AI's existing array parser without a
coordinated rollout. Consumers opting in must inspect the ordered outcomes and failure reasons.
Generated Java, Python, and TypeScript models share the response schema. The bulk create-or-update
API keeps its separate contract.

## Amendment v5: SDK defaults and retry behavior

The Java fluent and Python SDK bulk-create facades default to `onConflict=skip`, always request
the detailed `BulkCreateResult`, and are unsupported against servers without `onConflict`.
This applies to both `TestCases` and `GlossaryTerms`; the legacy Java service overload in v4
keeps its existing array response.

The Python facades disable REST-level retries for the bulk POST (`retries=0`). A 503 or 504 can
arrive after chunks committed, and replaying the batch would replace the original created outcomes
with conflicts. HTTP errors propagate; an empty or missing response raises a clear `RuntimeError`
instead of a model validation error. Neither error proves that creation rolled back.
