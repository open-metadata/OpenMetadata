# Preserve NOT NULL and UNIQUE independently on a column

- **Status:** Accepted
- **Revisions:** v1 2026-11-20 (initial)
- **Deciders:** PR contributors; final adoption subject to maintainer review
- **Guard:** `ingestion/tests/unit/topology/database/test_complex_column_constraints.py`, `ingestion/tests/unit/observability/data_quality/validations/runtime_param_setter/test_table_diff_params_setter.py`, `openmetadata-service/src/test/java/org/openmetadata/service/util/ODCSConverterTest.java`
- **Related:** #37986

## Context

A column can be both UNIQUE and NOT NULL but the current
`table.json#/definitions/constraint` enum can only represent one or the other.
The SQLAlchemy ingestion handler currently replaces NOT_NULL with UNIQUE,
so catalog data loses an essential constraint. ODCS import and export also
cannot round-trip this combination.

## Decision

Add `NOT_NULL_UNIQUE` to the canonical schema enum. For one-column unique
constraints, ingestion maps nullable columns to UNIQUE and non-nullable
columns to NOT_NULL_UNIQUE. Single-column primary keys retain precedence.
ODCS exports the combined value as both unique=true and required=true, and
imports those two independent booleans back as NOT_NULL_UNIQUE.

## Compatibility and generation

Existing serialized values remain valid; no database migration is required
for the enum itself. Backend, Python and TypeScript generated models must
all be regenerated through the repository's canonical schema-first generator,
and tests run in Java, ingestion Python and UI before merge. Never hand-edit
generated model artifacts. Downstream UI representations of the new enum
also need coverage before the PR can be considered merge-ready.
