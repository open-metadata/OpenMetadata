# A Dremio schema is named by its folder path without its space

- **Status:** Accepted
- **Revisions:** v1 2026-11-18 (initial)
- **Deciders:** Charly Clairmont
- **Guard:** `TestSchemas` in `ingestion/tests/unit/source/database/dremio/test_metadata.py` and `test_a_folder_named_like_its_space_is_ingested` in `ingestion/tests/integration/dremio/test_metadata.py`
- **Related:** [#34366](https://github.com/open-metadata/OpenMetadata/issues/34366), [PR #36163](https://github.com/open-metadata/OpenMetadata/pull/36163)

## Context

Dremio organises datasets as `<space>.<folder>…<folder>.<dataset>`, where a space is either a space
or a source, and folders can nest. OpenMetadata has three levels: database, schema and table. Dremio
lists the space itself and each folder path in `INFORMATION_SCHEMA.SCHEMATA`, and a space can hold
datasets at its root, next to its folders. A folder can have the same name as its space:
`SCHEMATA` then lists both `sales` and `sales.sales`. If the schema name were the folder path
without its space in every case, that folder would get the name of the root and never be read.

## Decision

- A Dremio space is a database.
- The schema of the folder path `<space>.<folder…>` is named `<folder…>`: the path without its space
  (`sales.eu.monthly` is the schema `eu.monthly` of the database `sales`).
- The datasets at the root of a space are in a schema named after the space (`sales`).
- A folder whose path without its space is the name of the space keeps its full path as its schema
  name: the folder `sales.sales` is the schema `sales.sales`, whose FQN is
  `<service>.sales."sales.sales"`.
- The source keeps the Dremio path of each schema it lists, and reads every schema from that path.
  If a later path would get a schema name already in use, it is skipped with a warning and not
  ingested.

## Consequences

Every FQN of an existing space, folder and dataset stays as it was; only the folders named like
their space, which were not ingested at all, get a schema. Any code that turns a Dremio path into an
OpenMetadata FQN, such as lineage and usage, has to apply the same rule, including the exception for
a folder named like its space. A skipped path needs two folders whose names cannot be told apart,
such as `sales.sales.sales` next to `sales.sales`. Naming the root schema after something that
cannot be a folder name would remove the exception, but it would change the FQN of every dataset at
the root of a space.
