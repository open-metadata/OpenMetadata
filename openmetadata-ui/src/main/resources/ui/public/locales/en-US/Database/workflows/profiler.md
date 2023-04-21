# Profiler
This workflow allows you to profile your table assets an gain insight into their structure (e.g. of metrics computed: `max`, `min`, `mean`, etc. The full list can be found [here](https://docs.open-metadata.org/connectors/ingestion/workflows/profiler/metrics)). We recommend to check the [best practices](https://docs.open-metadata.org/connectors/ingestion/workflows/profiler#profiler-best-practices) before creating a profiler workflow.

## Properties

$$section
### Database Filter Pattern $(id="databaseFilterPattern")
Regex to only fetch databases that matches the pattern.
$$

$$section
### Schema Filter Pattern $(id="schemaFilterPattern")
Regex to only fetch schema that matches the pattern.
$$

$$section
### Table Filter Pattern $(id="tableFilterPattern")
Regex exclude tables that matches the pattern.
$$

$$section
### Profile Sample $(id="profileSample")
Percentage of data or number of rows to use when sampling tables. If left as is, the profiler will run against the entire table.
$$

$$section
### Profile Sample Type $(id="profileSampleType")
Profile sample type can be set to either:  
* percentage: this will use a percentage to sample sample the table (e.g. table has 100 rows and we set sample percentage tp 50%, the profiler will use 50 random rows to compute the metrics)
* row count: this will use a number of rows to sample the table (e.g. table has 100 rows and we set row count to 10, the profiler will use 10 random rows to compute the metrics)
$$

$$section
### Thread Count $(id="threadCount")
Number of thread that will be used when computing the profiler metrics. A number set to high can have negative effect on performance. We recommend to use the default value unless you have a good understanding of multithreading.
$$

$$section
### Timeout in Seconds $(id="timeoutSeconds")
This will set the duration a profiling job against a table should wait before interrupting its execution and moving on to profiling the next table. It is important to note that the profiler will wait for the hanging query to terminiate before killing the execution. If there is a risk for your profiling job to hang, it is important to also set a query/connection timeout on your database engine. The default value for the profiler timeout is 12-hours.
$$

$$section
### Ingest Sample Data $(id="generateSampleData")

Set the Ingest Sample Data toggle to control whether or not to ingest sample data as part of profiler ingestion. If this toggle is enabled, 100 rows will be ingested by default.
$$

$$section
### Enable Debug Logs $(id="loggerLevel")

Set the `Enable Debug Log` toggle to set the default log level to debug, these logs can be viewed later in Airflow.
$$

$$section
### Auto Tag PII $(id="processPiiSensitive")

Set the `Auto Tag PII` toggle to control whether or not automatically tag columns that might contain sensitive information as part of profiler ingestion. 

If `Ingest Sample Data` is enabled, OpenMetadata will leverage machine learning to infer which column may contain PII sensitive data. If disabled, OpenMetadata will infer from the column name.
$$