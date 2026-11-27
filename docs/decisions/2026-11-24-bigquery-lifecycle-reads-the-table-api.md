# BigQuery lifecycle reads the table API, never a region-scoped INFORMATION_SCHEMA view

- **Status:** Accepted
- **Revisions:** v1 2026-11-24 (initial)
- **Deciders:** ulixius9
- **Guard:** `ingestion/tests/unit/topology/database/test_bigquery.py` (`test_life_cycle_comes_from_table_object_without_billed_query`, `test_life_cycle_query_stays_dataset_scoped_when_region_resolves`)
- **Related:** #38207, #38244, #30316, #23337

## Context
#30316 filled `lifeCycle.updated` from `INFORMATION_SCHEMA.TABLE_STORAGE.storage_last_modified_time`.
That view exists only at region level, and a region-qualified view bills the whole project/region on
every query whatever its `table_schema` filter. The query ran once per dataset and more under
`threads > 1`, taking one deployment from about 13 MB to 2.7 GB billed per job. The BigQuery
`tables.get` object is already fetched and cached for every table to build its columns, and it
carries `created` and `modified`.

## Decision
- An ordinary table's `lifeCycle.created` and `lifeCycle.updated` are the `created` and `modified`
  of its `tables.get` object. No SQL runs for them.
- A shard family's `created` is the earliest shard creation from the dataset-qualified
  `INFORMATION_SCHEMA.TABLES` query, run once per dataset. Its `updated` is the `modified` of the
  representative (newest) shard's table object.
- No lifecycle path queries a `region-*` INFORMATION_SCHEMA view.

## Consequences
Lifecycle bills nothing for ordinary tables and the dataset-minimum for shard families. `updated` is
BigQuery's `lastModifiedTime`: it also moves on metadata-only edits (description, labels, schema,
expiration), not only on data writes, matching the console's "Last modified". A write to an older
shard that is not the newest does not move its family's `updated`. Revisit only if consumers need
data-write time specifically, and then from a source that does not bill per region.
