# Metadata

ML Model Metadata Pipeline Configuration.

## Configuration

$$section

### ML Model Filter Pattern $(id="mlModelFilterPattern")

ML Model filter patterns to control whether to include ML Models as part of metadata ingestion.

**Include**: Explicitly include ML Models by adding a list of regular expressions to the `Include` field. OpenMetadata will include all ML Models with names matching one or more of the supplied regular expressions. All other ML Models will be excluded.

For example, to include only those ML Models whose name starts with the word `demo`, add the regex pattern in the include field as `^demo.*`.

**Exclude**: Explicitly exclude ML Models by adding a list of regular expressions to the `Exclude` field. OpenMetadata will exclude all ML Models with names matching one or more of the supplied regular expressions. All other ML Models will be included.

For example, to exclude all ML Models with the name containing the word `demo`, add the regex pattern in the exclude field as `.*demo.*`.

Checkout [this](https://docs.open-metadata.org/connectors/ingestion/workflows/metadata/filter-patterns/database#database-filter-pattern) document for further examples on filter patterns.
$$

$$section
### Enable Debug Logs $(id="enableDebugLog")

Set the `Enable Debug Log` toggle to set the logging level of the process to debug. You can check these logs in the Ingestion tab of the service and dig deeper into any errors you might find.
$$

$$section
### Mark Deleted Ml Model $(id="markDeletedMlModels")

Optional configuration to soft delete ML Models in OpenMetadata if the source models are deleted. After deleting, all the associated entities like lineage, etc., with that ML Model will be deleted.
$$

$$section
### Number of Retries $(id="retries")

Times to retry the workflow in case it ends with a failure.
$$