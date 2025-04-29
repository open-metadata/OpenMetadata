# Lineage

Extracting lineage information from Database Services happens by extracting the queries ran against the service and parsing them.

Depending on the service, these queries are picked up from query history tables such as `query_history` in Snowflake, or via API calls for Databricks or Athena.

$$note

Note that in order to find the lineage information, you will first need to have the tables in OpenMetadata by running the Metadata Workflow. We use the table names identified in the queries to match the information present in OpenMetadata.

$$

## Configuration

Depending on the number of queries ran in the service, this can become an expensive operation. We offer two ways of limiting the number of parsed queries:

$$section
### Query Log Duration $(id="queryLogDuration")

This is the value in **days** to filter out past queries. For example, being today `2023/04/19`, if we set this value as 2, we would be listing queries from `2023/04/17` until `2023/04/19` (included).
$$

$$section
### Result Limit $(id="resultLimit")

Another way to limit data is by adding a maximum number of records to process. This value works as:

```sql
SELECT xyz FROM query_history limit <resultLimit>
```

This value will take precedence over the `Query Log Duration`.
$$


$$section
### Filtering Condition $(id="filterCondition")

We execute a query on query history table of the respective data source to perform the query analysis and extract the lineage and usage information. This field will be useful when you want to restrict some queries from being part of this analysis. In this field you can specify a sql condition that will be applied on the query history result set.

For example: `query_text not ilike '--- metabase query %'`

Checkout [this](https://docs.open-metadata.org/connectors/ingestion/workflows/usage/filter-query-set) document for further examples on filter conditions.
$$

$$section
### Query Parsing Timeout Limit $(id="parsingTimeoutLimit")

Specify the timeout limit for parsing the sql queries to perform the lineage analysis.
$$

$$section
### Number of Retries $(id="retries")

Times to retry the workflow in case it ends with a failure.
$$

$$section
### Raise on Error $(id="raiseOnError")

Mark the workflow as failed or avoid raising exceptions.
$$