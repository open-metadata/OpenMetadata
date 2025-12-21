# Lineage

Extracting lineage information from Database Services happens by extracting the queries ran against the service and parsing them.

Depending on the service, these queries are picked up from query history tables such as `query_history` in Snowflake, or via API calls for Databricks or Athena.

$$note

Note that in order to find the lineage information, you will first need to have the tables in OpenMetadata by running the Metadata Workflow. We use the table names identified in the queries to match the information present in OpenMetadata.

$$

## Configuration

$$section
### Database Filter Pattern $(id="databaseFilterPattern")

Regex pattern to only fetch databases that match the pattern. Use this to include or exclude specific databases from lineage processing.
$$

$$section
### Schema Filter Pattern $(id="schemaFilterPattern")

Regex pattern to only fetch schemas that match the pattern. This helps you focus lineage processing on specific schemas within your databases.
$$

$$section
### Table Filter Pattern $(id="tableFilterPattern")

Regex pattern to include or exclude tables/views that match the pattern.

**Note:** Currently this filter is only applied to views during view lineage processing. It filters which views will be processed for lineage extraction.
$$

$$section
### Stored Procedure Filter Pattern $(id="storedProcedureFilterPattern")

Regex pattern to only fetch stored procedures that match the pattern. This allows you to control which stored procedures are analyzed for lineage.
$$

$$section
### Enable Debug Log $(id="enableDebugLog")

Set the `Enable Debug Log` toggle to set the logging level of the process to debug. You can check these logs in the Ingestion tab of the service and dig deeper into any errors you might find.
$$

$$section
### Query Log Duration $(id="queryLogDuration")

This is the value in **days** to filter out past queries. For example, being today `2023/04/19`, if we set this value as 2, we would be listing queries from `2023/04/17` until `2023/04/19` (included). Default is 1 day.
$$

$$section
### Query Log File Path $(id="queryLogFilePath")

Configuration to set the file path for query logs. This is useful when you want to read queries from a file instead of the database's query history tables.
$$

$$section
### Result Limit $(id="resultLimit")

Maximum number of records to process from query history. This value works as:

```sql
SELECT xyz FROM query_history limit <resultLimit>
```

This value will take precedence over the `Query Log Duration`. Default is 1000.
$$

$$section
### Query Parsing Timeout Limit $(id="parsingTimeoutLimit")

Specify the timeout limit in seconds for parsing SQL queries to perform the lineage analysis. Default is 300 seconds (5 minutes).
$$

$$section
### Query Parser Type $(id="queryParserConfig.type")

Choose the SQL parser for lineage extraction:
- **Auto** (default): Automatically tries SqlGlot first, falls back to SqlFluff, then SqlParse. Recommended for best results.
- **SqlGlot**: High-performance parser with good dialect support. Falls back to SqlParse on failure.
- **SqlFluff**: Comprehensive but slower parser with strong dialect support. Falls back to SqlParse on failure.
- **SqlParse**: Generic ANSI SQL parser with limited dialect support.
$$

$$section
### Filtering Condition $(id="filterCondition")

We execute a query on query history table of the respective data source to perform the query analysis and extract the lineage and usage information. This field will be useful when you want to restrict some queries from being part of this analysis. In this field you can specify a sql condition that will be applied on the query history result set.

For example: `query_text not ilike '--- metabase query %'`

Checkout <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/usage/filter-query-set" target="_blank">this</a> document for further examples on filter conditions.
$$

$$section
### Override View Lineage $(id="overrideViewLineage")

Set the `Override View Lineage` toggle to control whether to override existing view lineage. When enabled, newly discovered lineage will replace any existing lineage for views. Default is `false`.
$$

$$section
### Process View Lineage $(id="processViewLineage")

Set the `Process View Lineage` toggle to control whether to process view lineage. When enabled (default), OpenMetadata will analyze view definitions to extract lineage information. Default is `true`.
$$

$$section
### Process Query Lineage $(id="processQueryLineage")

Set the `Process Query Lineage` toggle to control whether to process query lineage from query history. When enabled (default), OpenMetadata will analyze historical queries to build lineage relationships. Default is `true`.
$$

$$section
### Process Stored Procedure Lineage $(id="processStoredProcedureLineage")

Set the `Process Stored Procedure Lineage` toggle to control whether to process stored procedure lineage. When enabled (default), OpenMetadata will analyze stored procedures to extract lineage information. Default is `true`.
$$

$$section
### Number of Threads $(id="threads")

Number of threads to use for parallel lineage ingestion. Increasing this value can speed up processing but will consume more resources. Minimum value is 1. Default is `1`.
$$

$$section
### Process Cross Database Lineage $(id="processCrossDatabaseLineage")

Set the `Process Cross Database Lineage` toggle to control whether to process table lineage across different databases. When enabled, OpenMetadata can track lineage relationships between tables in different databases. Default is `false`.
$$

$$section
### Cross Database Service Names $(id="crossDatabaseServiceNames")

List of database service names to include when processing cross-database lineage. This is required when `Process Cross Database Lineage` is enabled. Specify the service names that should be considered for cross-database lineage analysis.

Example: `database_service_1`, `database_service_2`
$$

$$section
### Enable Temp Table Lineage $(id="enableTempTableLineage")

Set the `Enable Temp Table Lineage` toggle to handle lineage for temporary and transient tables (specifically for Snowflake). When enabled, OpenMetadata will track lineage involving temporary tables that might otherwise be ignored. Default is `false`.
$$

$$section
### Incremental Lineage Processing $(id="incrementalLineageProcessing")

Set the `Incremental Lineage Processing` toggle to control whether to process lineage incrementally. When enabled (default), OpenMetadata will only process new or changed queries since the last run, improving performance. Default is `true`.
$$