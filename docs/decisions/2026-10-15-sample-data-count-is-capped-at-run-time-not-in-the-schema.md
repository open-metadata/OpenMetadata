# Auto-classification `sampleDataCount` is capped at run time, not in the schema

- **Status:** Accepted
- **Revisions:** v1 2026-10-15 (initial)
- **Deciders:** Ingestion maintainers, in #35550
- **Guard:** `test_schema_accepts_sample_data_count_above_runtime_cap` and
  `test_budget_above_maximum_is_clamped_with_warning` in
  `ingestion/tests/unit/sampler/sqlalchemy/test_sample_budget.py`
- **Related:** #34622; #34638 (honored the budget, added the schema `maximum`); #35550 (removed it);
  #35492 (2.0 backport)

## Context

Auto-classification used to cut every sample to 50 rows, so any `sampleDataCount` was accepted and
silently ignored above 50. #34638 made the budget real and capped it at 1000 rows
(`SAMPLE_DATA_MAX_COUNT`). It also put `"maximum": 1000` on `sampleDataCount` in the database,
messaging and storage auto-classification pipeline schemas.

A schema `maximum` becomes `le=1000` in the generated Pydantic model. Pipelines already saved with a
larger value — valid until then — would fail workflow validation after upgrade and stop running,
and no migration lowers the stored values.

## Decision

- `sampleDataCount` in the auto-classification pipeline schemas has **no** `maximum`.
- The 1000-row cap is enforced only at run time, by `SamplerInterface._bounded_sample_limit`, which
  clamps to `SAMPLE_DATA_MAX_COUNT` and logs a warning.

## Consequences

- Saved pipelines with any positive `sampleDataCount` keep running across upgrades.
- The UI form accepts values above 1000; they run as 1000 with a warning in the pipeline logs.
- Adding a schema `maximum` back needs a migration that clamps stored `sampleDataCount` values in the
  same release; without one it breaks saved pipelines again.
