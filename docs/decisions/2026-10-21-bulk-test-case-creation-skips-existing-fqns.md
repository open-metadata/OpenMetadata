# Bulk test-case creation skips existing fully qualified names

- **Status:** Accepted
- **Revisions:** v1 2026-10-21 (initial), v2 2026-10-21 (shared bulk-create recovery), v3 2026-10-21 (preparation races)
- **Deciders:** Harsha
- **Guard:** `TestCaseResourceIT`, `GlossaryTermResourceIT`, `EntityBulkCreateRecoveryIT`
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
