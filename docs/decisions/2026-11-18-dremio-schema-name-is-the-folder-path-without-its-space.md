# A Dremio schema is named by its folder path without its space, and the root of a space is `default`

- **Status:** Accepted
- **Revisions:** v1 2026-11-18 (initial)
- **Deciders:** Charly Clairmont, ulixius9
- **Guard:** `TestNames` in `ingestion/tests/unit/source/database/dremio/test_metadata.py` and `test_a_folder_named_like_its_space_is_ingested` in `ingestion/tests/integration/dremio/test_metadata.py`
- **Related:** [#34366](https://github.com/open-metadata/OpenMetadata/issues/34366), [PR #36163](https://github.com/open-metadata/OpenMetadata/pull/36163), ADR:2026-11-23-dremio-connector-reads-the-rest-api-not-arrow-flight

## Context

Dremio organises datasets as `<space>/<folder>…/<folder>/<dataset>`, where a space is either a space
or a source, and folders can nest. OpenMetadata has three levels: database, schema and table. A
space can hold datasets at its root, next to its folders. Services ingested by the earlier REST
connector already put those datasets in a schema named `default`; naming it otherwise would
re-create every one of them under a new FQN and soft-delete the old entity with its descriptions,
owners, tags, lineage and tests.

## Decision

- A Dremio space or source is a database.
- The schema of the folder path `<space>/<folder…>` is the folders joined with `.`
  (`sales/eu/monthly` is the schema `eu.monthly` of the database `sales`).
- The datasets at the root of a space are in the schema `default` (`ROOT_SCHEMA` in `metadata.py`).
- A folder named like its space is the schema of that name: the folder `sales/sales` is the schema
  `sales` of the database `sales`.
- Only the folders that hold datasets are schemas.

## Consequences

The FQNs of the services ingested by the earlier connector do not change. Two paths can give the
same schema name, and their datasets are then ingested together: a folder named `default` at the
root of a space, and a folder whose name holds a `.` next to the nested folders it spells
(`a.b` and `a/b`). SQL that names a root dataset as `space.dataset` does not spell `default`, so a
lookup by exact FQN misses it; view lineage of Dremio falls back to a schema wildcard for this
reason (`get_view_lineage` in `ingestion/src/metadata/utils/db_utils.py`).
