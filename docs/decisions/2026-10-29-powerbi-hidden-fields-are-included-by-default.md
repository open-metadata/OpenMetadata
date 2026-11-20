# Power BI ingests hidden fields by default; turning that off keeps hidden tables' table-level lineage only

- **Status:** Accepted
- **Revisions:** v1 2026-10-29 (initial)
- **Deciders:** Kasidech C.
- **Guard:** `test_powerbi.py` (`test_hidden_fields_*`, `test_hidden_table_keeps_table_lineage_without_columns_when_include_hidden_fields_disabled`, `test_hidden_column_lineage_skipped_when_include_hidden_fields_disabled`), `test_powerbi_metrics.py` (`test_hidden_table_measures_emit_no_metrics_when_include_hidden_fields_disabled`)
- **Related:** open-metadata/OpenMetadata#36514, `powerBIConnection.json` `includeHiddenFields`

## Context
Power BI report authors hide helper tables, key columns and intermediate measures (`isHidden`). The
connector ingested them all into the Dashboard Data Model, so OpenMetadata showed fields that Power BI
hides. Some users want them out; existing services may have tags and descriptions on them.

## Decision
- The Power BI connection has a boolean `includeHiddenFields`, **default `true`**: hidden tables,
  columns and measures are ingested as before, and hidden measures keep `MEASURE_HIDDEN`.
- With `false`, hidden tables, columns and measures are left out of the data model's columns.
- With `false`, a hidden table keeps its table-level lineage edge (it still feeds the model's
  measures) but gets no column lineage, and hidden columns of visible tables get no column lineage.
  `_get_data_model_column_fqn` matches by column name only, so a hidden column would otherwise link
  to a same-named column of another table.
- With `false`, measures of a hidden table get no Metric. Metrics already created are not removed:
  the connector never deletes Metrics it stops emitting.

## Consequences
- Upgrading changes nothing for existing services; skipping hidden fields is opt-in.
- Turning the option off removes hidden fields, with their tags and descriptions, from the data model
  on the next run, and leaves earlier Metrics of hidden tables in place.
- Flipping the default to `false`, or dropping the table-level edge of hidden tables, needs a new
  record.
