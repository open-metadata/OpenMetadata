# Athena reports at most 100 individual Hive view definition warnings per ingestion run

- **Status:** Accepted
- **Revisions:** v1 2026-10-12 (initial)
- **Deciders:** harshsoni2024
- **Guard:** `TestAthenaHiveViewDefinitionWarning` in `ingestion/tests/unit/topology/database/test_athena.py`
- **Related:** [collate#5938](https://github.com/open-metadata/openmetadata-collate/issues/5938)

## Context

Athena can list Hive views stored in Glue while `SHOW CREATE VIEW` cannot provide their definitions.
The connector used to ingest those views with no definition and no workflow warning. A warning for
every affected view would make workflow status grow with the size of a catalog.

## Decision

Athena identifies a Hive view from Glue's `VIRTUAL_VIEW` metadata and skips `SHOW CREATE VIEW` for
that view. A Hive view is any Glue view that is neither an Athena view nor a Data Catalog view. Views
created by Spark count, because Spark stores them in Glue in the same Hive form and Athena cannot read
them either. The source adds a workflow warning keyed by the OpenMetadata table FQN for each of the
first 100 Hive views, then one summary warning for further views. Warning text describes the
limitation and action without including source SQL or credentials. Athena and Data Catalog views
continue through their existing definition lookup.

## Consequences

Workflow status contains at most 101 warnings from this condition, regardless of catalog size.
Operators see FQNs for the first 100 affected views and a summary when there are more. Detecting
the view format adds one Glue `GetTable` request per view; if Glue cannot answer, the connector uses
the existing Athena definition path.
