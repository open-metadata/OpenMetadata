# Elasticsearch Search Reindex

Elasticsearch Search Reindex Pipeline Configuration.

$$section

### Enable Debug Logs $(id="enableDebugLog")

Set the `Enable Debug Log` toggle to set the default log level to debug, these logs can be viewed later in Airflow.
$$

$$section

### Batch Size $(id="batchSize")

Maximum number of entities that are processed together in one iteration.
$$

$$section

### Search Index Mapping Language $(id="searchIndexMappingLanguage")

Select the default language for reindexing search.
$$

$$section

### Recreate Index $(id="recreateIndex")

This option if enabled, will delete the existing indexes and create them again.
$$

$$section
### Number of Retries $(id="retries")

Times to retry the workflow in case it ends with a failure.
$$

$$section
### Raise on Error $(id="raiseOnError")

Mark the workflow as failed or avoid raising exceptions.
$$