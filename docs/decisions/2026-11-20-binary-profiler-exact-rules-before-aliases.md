# Prefer exact binary profiler rules before alias rules

- **Status:** Accepted
- **Revisions:** v1 2026-11-20 (initial)
- **Deciders:** Issue #38223 owner and implementers
- **Guard:** `test_exact_binary_rules_are_independent_of_alias_order`, `test_exact_default_rule_beats_alias_disable`, `test_absent_exact_rule_preserves_first_alias_fallback` in `ingestion/tests/unit/observability/profiler/test_binary_metric_filter.py`
- **Related:** https://github.com/open-metadata/OpenMetadata/issues/38223

## Context

BINARY, VARBINARY, BLOB, BYTES and BYTEA share the profiler's `HexByteString` SQLAlchemy representation. Reconstructing catalog types from that class loses their identity: conflicting global rules select whichever alias appears first. The reverse map also omitted BINARY and VARBINARY, so their rules could be ignored altogether.

## Decision

Retain the original catalog type in namespaced SQLAlchemy column `info` metadata for these five binary types. Prefer the first global rule matching that exact type. An enabled rule with absent or empty metrics selects defaults; a disabled rule selects no metrics even when metrics are listed. Duplicate exact rules remain first-wins.

If there is no exact rule or no retained type, use the existing reverse-map alias set and first matching row. Include all five types in the `HexByteString` reverse map while preserving native SQLAlchemy reverse entries.

## Consequences

Explicit binary rules work independently of alias ordering without changing SQL types or binary decoding. A BLOB-only rule can still apply to BINARY when no BINARY rule exists. Manually constructed SQLAlchemy columns retain alias ordering, as do unrelated shared types such as SMALLINT and TINYINT. Removing alias fallback or extending exact precedence to other families requires a separate behavior decision.
