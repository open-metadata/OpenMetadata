---
title: Lineage Workflow Through Query Logs
slug: /connectors/ingestion/workflows/lineage/lineage-workflow-query-logs
---

# Lineage Workflow Through Query Logs

The following database connectors supports lineage workflow in OpenMetadata:
- [BigQuery](/connectors/database/bigquery)
- [Snowflake](/connectors/database/snowflake)
- [MSSQL](/connectors/database/mssql)
- [Redshift](/connectors/database/redshift)
- [Clickhouse](/connectors/database/clickhouse)
- [Databricks](/connectors/database/databricks)
- [Postgres](/connectors/database/postgres)

If you are using any other database connector, direct execution of lineage workflow is not possible. This is mainly because these database connectors does not maintain query execution logs which is required for lineage workflow. This documentation will help you to learn, how to execute the lineage workflow using a query log file for all the database connectors.

## Query Log File
A query log file is a CSV file which contains the following information.

- **query:** This field contains the literal query that has been executed in the database.
- **user_name (optional):** Enter the database user name which has executed this query.
- **start_time (optional):** Enter the query execution start time in YYYY-MM-DD HH:MM:SS format.
- **end_time (optional):** Enter the query execution end time in YYYY-MM-DD HH:MM:SS format.
- **aborted (optional):** This field accepts values as true or false and indicates whether the query was aborted during execution
- **database_name (optional):** Enter the database name on which the query was executed.
- **schema_name (optional):** Enter the schema name to which the query is associated.

Checkout a sample query log file [here](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/examples/sample_data/glue/query_log.csv).

## Lineage Workflow
In order to run a Lineage Workflow we need to make sure that Metadata Ingestion Workflow for corresponding service has already been executed. We will follow the steps to create a JSON configuration able to collect the query log file and execute the lineage workflow.

### 1. Create a configuration file using template YAML
Create a new file called `query_log_lineage.yaml` in the current directory. Note that the current directory should be the openmetadata directory.
Copy and paste the configuration template below into the `query_log_lineage.yaml` the file you created. 
```yaml
source:
  type: query-log-lineage
  serviceName: local_mysql
  serviceConnection:
    config:
      type: Mysql
      username: openmetadata_user
      password: openmetadata_password
      hostPort: localhost:3306
      connectionOptions: {}
      connectionArguments: {}
  sourceConfig:
    config:
      queryLogFilePath: <path to query log file>
processor:
  type: query-parser
  config: {}
stage:
  type: table-lineage
  config:
    filename: /tmp/query_log_lineage
bulkSink:
  type: metadata-lineage
  config:
    filename: /tmp/query_log_lineage
workflowConfig:
  openMetadataServerConfig:
    hostPort: <OpenMetadata host and port>
    authProvider: <OpenMetadata auth provider>
```
The `serviceName` and `serviceConnection` used in the above config has to be the same as used during Metadata Ingestion.
The sourceConfig is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/databaseServiceQueryLineagePipeline.json).
- queryLogFilePath: Enter the file path of query log csv file.

### 2. Run with the CLI
First, we will need to save the YAML file. Afterward, and with all requirements installed, we can run:
```yaml
metadata ingest -c <path-to-yaml>
```
Note that from connector-to-connector, this recipe will always be the same. By updating the YAML configuration, you will be able to extract metadata from different sources.
