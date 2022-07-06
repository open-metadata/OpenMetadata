# Usage Workflow Through Query Logs

The following database connectors supports usage workflow in OpenMetadata:

* [BigQuery](../integrations/connectors/bigquery/)
* [Snowflake](../integrations/connectors/snowflake/)
* [MSSQL](../integrations/connectors/mssql/)
* [Redshift](../integrations/connectors/redshift/)
* [Clickhouse](../docs/data-lineage/broken-reference/)

If you are using any other database connector, direct execution of usage workflow is not possible. This is mainly because these database connectors does not maintain query execution logs which is required for usage workflow. This documentation will help you to learn, how to execute the usage workflow using a query log file for all the database connectors.

## Query Log File

A query log file is a CSV file which contains the following information.

* **query:** This field contains the literal query that has been executed in the database.
* **user\_name (optional):** Enter the database user name which has executed this query.
* **start\_time (optional):** Enter the query execution start time in `YYYY-MM-DD HH:MM:SS` format.
* **end\_time (optional):** Enter the query execution end time in `YYYY-MM-DD HH:MM:SS` format.
* **aborted (optional):** This field accepts values as `true` or `false` and indicates whether the query was aborted during execution
* **database\_name (optional):** Enter the database name on which the query was executed.
* **schema\_name (optional):** Enter the schema name to which the query is associated.

Checkout a sample query log file [here](https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/examples/sample\_data/glue/query\_log.csv).

## Usage Workflow

In order to run a Usage Workflow we need to make sure that Metadata Ingestion Workflow for corresponding service has already been executed. We will follow the steps to create a JSON configuration able to collect the query log file and execute the usage workflow.

### 1. Create a configuration file using template YAML

Create a new file called `query_log_usage.yaml` in the current directory. Note that the current directory should be the `openmetadata` directory.

Copy and paste the configuration template below into the `query_log_usage.yaml` the file you created.

{% code title="query_log_usage.yaml" %}
```
source:
  type: query-log-usage
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
  config:
    filter: ''
stage:
  type: table-usage
  config:
    filename: /tmp/query_log_usage
bulkSink:
  type: metadata-usage
  config:
    filename: /tmp/query_log_usage
workflowConfig:
  openMetadataServerConfig:
    hostPort: http://localhost:8585/api
    authProvider: no-auth
```
{% endcode %}

The `serviceName` and `serviceConnection` used in the above config has to be the same as used during Metadata Ingestion.

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/metadataIngestion/databaseServiceQueryUsagePipeline.json).

* queryLogFilePath: Enter the file path of query log csv file.

### 2. Run with the CLI

First, we will need to save the YAML file. Afterward, and with all requirements installed, we can run:

```
metadata ingest -c <path-to-yaml>
```

Note that from connector-to-connector, this recipe will always be the same. By updating the JSON configuration, you will be able to extract metadata from different sources.
