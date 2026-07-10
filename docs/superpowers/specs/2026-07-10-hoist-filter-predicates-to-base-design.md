# Hoist `_is_database_filtered` / `_is_schema_filtered` to the shared base — Design

## Problem

The pure filter predicates `_is_database_filtered(database_name)` and
`_is_schema_filtered(database_name, schema_name)` are copy-pasted across three
connectors:

- `bigquery/metadata.py` — both predicates (param named `project_id`)
- `redshift/metadata.py` — both predicates
- `snowflake/metadata.py` — `_is_schema_filtered` only

The bodies are identical except for cosmetic parameter naming and one extra
falsy-guard in Snowflake's schema variant. All three connectors already extend
the same base, `DatabaseServiceSource` (`database_service.py`), which owns
`self.metadata`, `self.context`, `self.source_config`, and `self.status` — so
the predicates have a natural single home.

## Scope (Option A — minimal)

Hoist the two predicates to `DatabaseServiceSource` and delete the connector
copies. **Do not** refactor the base's existing walk methods
(`_get_filtered_database_names`, `_get_filtered_schema_names`) — they keep their
current inline filter code. This eliminates the connector-level duplication the
request targets, with minimal blast radius. (The deeper base-vs-predicate
duplication is knowingly left for a possible later Option B.)

## Design

### 1. Add to `DatabaseServiceSource` (`database_service.py`)

Add `filter_by_database` to the filters import (currently only `filter_by_schema`,
`filter_by_stored_procedure`). `Database`, `DatabaseSchema`, and `fqn` are
already imported. Add the two methods (using Snowflake's safer
`... and fqn else name` guard so no connector regresses):

```python
def _is_database_filtered(self, database_name: str) -> bool:
    """Whether a database fails ``databaseFilterPattern``. Pure predicate — no
    status side effects — so the totals hook and the walk can share it."""
    database_fqn = fqn.build(
        self.metadata,
        entity_type=Database,
        service_name=self.context.get().database_service,
        database_name=database_name,
    )
    filter_name = database_fqn if self.source_config.useFqnForFiltering and database_fqn else database_name
    return filter_by_database(self.source_config.databaseFilterPattern, filter_name)

def _is_schema_filtered(self, database_name: str, schema_name: str) -> bool:
    """Whether a schema fails ``schemaFilterPattern``, matched the same way as
    the walk (FQN or bare name per ``useFqnForFiltering``). Context-free: the
    FQN is built from the explicit database name."""
    schema_fqn = fqn.build(
        self.metadata,
        entity_type=DatabaseSchema,
        service_name=self.context.get().database_service,
        database_name=database_name,
        schema_name=schema_name,
    )
    filter_name = schema_fqn if self.source_config.useFqnForFiltering and schema_fqn else schema_name
    return filter_by_schema(self.source_config.schemaFilterPattern, filter_name)
```

### 2. Delete the connector copies (call sites unchanged — they inherit)

- `bigquery/metadata.py`: delete `_is_database_filtered` and `_is_schema_filtered`.
  Call sites pass `project_id` as `database_name` (a BigQuery project *is* the
  database) — no call-site change. Remove now-unused imports `filter_by_database`,
  `filter_by_schema`.
- `redshift/metadata.py`: delete both predicates. Remove now-unused imports
  `filter_by_database`, `filter_by_schema`.
- `snowflake/metadata.py`: delete `_is_schema_filtered`. Remove now-unused import
  `filter_by_schema` **only** — `filter_by_database` stays (still used in
  `_compute_filtered_database_names`).

`Database` / `DatabaseSchema` imports remain in all three connectors (used by
`declare_progress_totals` and walk FQN builds).

## Behavior nuances (all verified safe)

1. BigQuery/Redshift `_is_schema_filtered` and both `_is_database_filtered` gain
   the `and fqn` falsy-guard from Snowflake's variant. Only changes anything if
   `fqn.build` returns falsy — which does not happen when service/db names are
   set. No observable change.
2. No change to the base walk methods, so every other SQL connector
   (Postgres, MySQL, Oracle, …) is untouched.

## Testing

- New unit test `tests/unit/source/database/test_base_filter_predicates.py`:
  instantiate a minimal `DatabaseServiceSource`-derived stub (or the smallest
  concrete connector) and assert `_is_database_filtered` / `_is_schema_filtered`
  return correctly for include/exclude patterns and for `useFqnForFiltering`
  True/False. Assert observable boolean outcomes, not mock wiring.
- Regression guard (must stay green, unchanged): the existing progress-count
  tests (`test_bigquery_progress_count.py`, `test_redshift_progress_count.py`,
  `test_snowflake_progress_count.py`) — they call the predicates and now
  exercise the inherited base versions — plus the connector suites
  `topology/database/test_bigquery.py`, `test_redshift.py`, `test_snowflake.py`.
- `ruff check` must pass (catches any leftover unused import).

## Net change

~+22 lines in the base; ~−45 lines across three connectors; one predicate
implementation shared by all database connectors' totals hooks and walks.
