# ClickZetta

Use this connector to ingest database, schema, table, view, and column metadata
from ClickZetta into OpenMetadata.

## Requirements

Create a ClickZetta user with read access to the workspace, virtual cluster,
schemas, and tables that OpenMetadata should catalog. Metadata extraction is
supported directly. Usage and query-lineage extraction additionally require a
read-only query-history table or view configured below. The connector supports
the standard OpenMetadata SQLAlchemy profiler and test suite, plus native
ClickZetta row-count and percentage sampling through `TABLESAMPLE ROW` or
`SYSTEM`. Data diff uses ClickZetta `DESCRIBE` metadata and generated comparison
queries. DBT artifacts can be ingested by the standard DBT pipeline attached to
this service; OpenMetadata does not run DBT models.

## Connection Details

$$section
### Host and Port $(id="hostPort")

Enter the ClickZetta instance and service host. Include the port only when your
deployment does not use the protocol's default port.
$$

$$section
### Username $(id="username")

Enter the ClickZetta user that has read access to the metadata being ingested.
$$

$$section
### Authentication $(id="authType")

Enter the password for the ClickZetta user. OpenMetadata stores this value as a
secret and does not include it in generated documentation or screenshots.
$$

$$section
### Workspace $(id="databaseName")

Enter the ClickZetta workspace. OpenMetadata represents the workspace as the
database level in the service hierarchy.
$$

$$section
### Virtual Cluster $(id="virtualCluster")

Enter the virtual cluster used to execute the connector's metadata queries.
$$

$$section
### Database Schema $(id="databaseSchema")

Optionally restrict ingestion to one schema. Leave this blank to let the
connector discover all schemas visible to the configured user.
$$

$$section
### Query History Table $(id="queryHistoryTable")

Optional table or view used by the usage and query-lineage workflows. For
workspace-local native ClickZetta history, enter:

`information_schema.job_history`

Use the cross-workspace source only when the ingestion identity has explicit
access to ClickZetta's shared system schema:

`sys.information_schema.job_history`

The connector maps ClickZetta's native job-history columns and automatically
scopes the source to the configured workspace and schema. A custom table or
view must expose these canonical columns:

`query_text`, `query_type`, `user_name`, `database_name`, `schema_name`,
`start_time`, `end_time`, `duration`, `aborted`, and `cost`.

If you set the workflow's `filterCondition`, use only `AND`-separated `=`,
`!=`, `<>`, `LIKE`, or `NOT LIKE` predicates on `database_name`,
`schema_name`, `query_type`, or `user_name`, with single-quoted string values.
For example: `schema_name = 'seller_center' AND user_name != 'system'`.
Arbitrary SQL, functions, subqueries, comments, and `OR` predicates are
rejected so workflow configuration cannot inject SQL.

Leave this blank when running metadata-only ingestion. For a first validation,
grant the ingestion identity read access to the native history object and set a
small query-log result limit. The connector applies a time window and result
limit; data-reading workflows remain separate and require their own bounded
configuration.
$$

$$section
### Protocol $(id="protocol")

Choose `https` for normal deployments. Use `http` only when the ClickZetta
endpoint is intentionally exposed without TLS in a trusted environment.
$$

$$section
### Connection Options $(id="connectionOptions")

Add optional SQLAlchemy URL query parameters as key-value pairs.
$$

$$section
### Connection Arguments $(id="connectionArguments")

Add optional keyword arguments passed to the SQLAlchemy engine.

Profiling, tests, custom SQL, and data diff can read table data. Use
OpenMetadata's profiler sampling settings, workflow filters, and explicitly
scoped test or diff configurations to control the ClickZetta workload.
$$
