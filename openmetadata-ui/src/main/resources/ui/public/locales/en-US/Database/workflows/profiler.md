# Profiler

This workflow allows you to profile your table assets and gain insights into their structure (e.g. of metrics computed: `max`, `min`, `mean`, etc. The full list can be found [here](https://docs.open-metadata.org/connectors/ingestion/workflows/profiler/metrics)).

We recommend to check the [best practices](https://docs.open-metadata.org/connectors/ingestion/workflows/profiler#profiler-best-practices) before creating a profiler workflow to avoid long-running pipelines and unexpected costs.

## Configuration

$$section
### Database Filter Pattern $(id="databaseFilterPattern")

Database filter patterns to control whether to include database as part of metadata ingestion.

**Include**: Explicitly include databases by adding a list of regular expressions to the `Include` field. OpenMetadata will include all databases with names matching one or more of the supplied regular expressions. All other databases will be excluded.

For example, to include only those databases whose name starts with the word `demo`, add the regex pattern in the include field as `^demo.*`.

**Exclude**: Explicitly exclude databases by adding a list of regular expressions to the `Exclude` field. OpenMetadata will exclude all databases with names matching one or more of the supplied regular expressions. All other databases will be included.

For example, to exclude all databases with the name containing the word `demo`, add the regex pattern in the exclude field as `.*demo.*`.

Checkout [this](https://docs.open-metadata.org/connectors/ingestion/workflows/metadata/filter-patterns/database#database-filter-pattern) document for further examples on database filter patterns.
$$

$$section
### Schema Filter Pattern $(id="schemaFilterPattern")

Schema filter patterns are used to control whether to include schemas as part of metadata ingestion.

**Include**: Explicitly include schemas by adding a list of regular expressions to the `Include` field. OpenMetadata will include all schemas with names matching one or more of the supplied regular expressions. All other schemas will be excluded.

For example, to include only those schemas whose name starts with the word `demo`, add the regex pattern in the include field as `^demo.*`.

**Exclude**: Explicitly exclude schemas by adding a list of regular expressions to the `Exclude` field. OpenMetadata will exclude all schemas with names matching one or more of the supplied regular expressions. All other schemas will be included.

For example, to exclude all schemas with the name containing the word `demo`, add regex pattern in the exclude field as `.*demo.*`.

Checkout [this](https://docs.open-metadata.org/connectors/ingestion/workflows/metadata/filter-patterns/database#database-filter-pattern) document for further examples on schema filter patterns.
$$

$$section
### Table Filter Pattern $(id="tableFilterPattern")

Table filter patterns are used to control whether to include tables as part of metadata ingestion.

**Include**: Explicitly include tables by adding a list of regular expressions to the `Include` field. OpenMetadata will include all tables with names matching one or more of the supplied regular expressions. All other tables will be excluded.

For example, to include only those tables whose name starts with the word `demo`, add the regex pattern in the include field as `^demo.*`.

**Exclude**: Explicitly exclude tables by adding a list of regular expressions to the `Exclude` field. OpenMetadata will exclude all tables with names matching one or more of the supplied regular expressions. All other tables will be included.

For example, to exclude all tables with the name containing the word `demo`, add the regex pattern in the exclude field as `.*demo.*`.

Checkout [this](https://docs.open-metadata.org/connectors/ingestion/workflows/metadata/filter-patterns/database#table-filter-pattern) document for further examples on table filter patterns.
$$

$$section
### Profile Sample $(id="profileSample")
Percentage of data or number of rows to use when sampling tables. 

By default, the profiler will run against the entire table.
$$

$$section
### Profile Sample Type $(id="profileSampleType")
The sample type can be set to either:  

* **Percentage**: this will use a percentage to sample the table (e.g. if table has 100 rows, and we set sample percentage tp 50%, the profiler will use 50 random rows to compute the metrics).
* **Row Count**: this will use a number of rows to sample the table (e.g. if table has 100 rows, and we set row count to 10, the profiler will use 10 random rows to compute the metrics).
$$

$$section
### Thread Count $(id="threadCount")
Number of threads that will be used when computing the profiler metrics. A high number can have negative performance effect.

We recommend to use the default value unless you have a good understanding of multithreading and your database is capable of handling multiple concurrent connections.
$$

$$section
### Timeout (Seconds) $(id="timeoutSeconds")

This will set the duration a profiling job against a table should wait before interrupting its execution and moving on to profiling the next table.

It is important to note that the profiler will wait for the hanging query to **terminate** before killing the execution. If there is a risk for your profiling job to hang, it is important to also set a query/connection timeout on your database engine. The default value for the profiler timeout is 12 hours.
$$

$$section
### Ingest Sample Data $(id="generateSampleData")

Set the Ingest Sample Data toggle to control whether to ingest sample data as part of profiler ingestion. If this is enabled, 100 rows will be ingested by default.
$$

$$section
### Enable Debug Logs $(id="enableDebugLog")

Set the `Enable Debug Log` toggle to set the logging level of the process to debug. You can check these logs in the Ingestion tab of the service and dig deeper into any errors you might find.
$$

$$section
### Auto Tag PII $(id="processPiiSensitive")

Set the `Auto Tag PII` toggle to control whether to automatically tag columns that might contain sensitive information as part of profiler ingestion. 

If `Ingest Sample Data` is enabled, OpenMetadata will leverage machine learning to infer which column may contain PII sensitive data. If disabled, OpenMetadata will infer this information from the column name.
$$

$$section
### Number of Retries $(id="retries")

Times to retry the workflow in case it ends with a failure.
$$