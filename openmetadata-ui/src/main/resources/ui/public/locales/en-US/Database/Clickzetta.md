# ClickZetta

Use this connector to ingest database, schema, table, view, and column metadata
from ClickZetta into OpenMetadata.

## Requirements

Create a ClickZetta user with read access to the workspace, virtual cluster,
schemas, and tables that OpenMetadata should catalog. The current connector is
metadata-only: usage, query lineage, profiling, and native dbt extraction remain
disabled until those workflows are implemented and validated.

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
$$
