---
title: Lineage Workflow Through Query Logs
slug: /connectors/ingestion/workflows/lineage/lineage-workflow-query-logs
---

# Lineage Workflow Through Query Logs

In order to extract lineage information, OpenMetadata parses the queries that have run against the database. This query
log information is available from WITHIN the database in the following services:

- [BigQuery](/connectors/database/bigquery)
- [Snowflake](/connectors/database/snowflake)
- [MSSQL](/connectors/database/mssql)
- [Redshift](/connectors/database/redshift)
- [Clickhouse](/connectors/database/clickhouse)
- [Databricks](/connectors/database/databricks)
- [PostgreSQL](/connectors/database/postgres)

If you are using any other database connector, direct execution of lineage workflow is not possible. 
This is mainly because these database connectors does not maintain query execution logs which is required for lineage workflow. 

If you are interested in running the lineage workflow for a connector not listed above, this documentation will help
you to execute the lineage workflow using a query log file. This can be arbitrarily executed for **any** database connector.

## Query Log File

A query log file is a standard CSV file which contains the following information.

{% note %}

A standard CSV should be comma separated, and each row represented as a single line in the file.

{% /note %}

- **query_text:** This field contains the literal query that has been executed in the database. It is quite possible
    that your query has commas `,` inside. Then, wrap each query in quotes to not have any clashes
    with the comma as a separator.
- **database_name (optional):** Enter the database name on which the query was executed.
- **schema_name (optional):** Enter the schema name to which the query is associated.

Checkout a sample query log file [here](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/examples/sample_data/glue/query_log.csv).

```csv
query_text,database_name,schema_name
"select * from sales",default,information_schema
"select * from marketing",default,information_schema
"insert into marketing select * from sales",default,information_schema
```

## Lineage Workflow
In order to run a Lineage Workflow we need to make sure that Metadata Ingestion Workflow for corresponding service has already been executed. We will follow the steps to create a JSON configuration able to collect the query log file and execute the lineage workflow.

### 1. Create a configuration file using template YAML

Create a new file called `query_log_lineage.yaml` in the current directory. Note that the current directory should be the openmetadata directory.
Copy and paste the configuration template below into the `query_log_lineage.yaml` the file you created. 

```yaml
source:
  type: query-log-lineage
  serviceName: <name>
  sourceConfig:
    config:
      type: DatabaseLineage
      queryLogFilePath: <path to query log file>
sink:
  type: metadata-rest
  config: {}
workflowConfig:
  loggerLevel: INFO
  openMetadataServerConfig:
    hostPort: <OpenMetadata host and port>
    authProvider: <OpenMetadata auth provider>
    securityConfig:
      jwtToken: "{bot_jwt_token}"
```

The `serviceName` should be a service already ingested in OpenMetadata.
- **queryLogFilePath**: Enter the file path of query log csv file.

### 2. Run with the CLI

First, we will need to save the YAML file. Afterward, and with all requirements installed, we can run:

```yaml
metadata ingest -c <path-to-yaml>
```

Note that from connector-to-connector, this recipe will always be the same. By updating the YAML configuration, you will be able to extract metadata from different sources.
