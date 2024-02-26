# Metadata

Messaging Service Metadata Pipeline Configuration.

## Configuration

$$section

### Topic Filter Pattern $(id="topicFilterPattern")

Topic filter patterns are used to control whether to include Topics as part of metadata ingestion.

**Include**: Explicitly include Topics by adding a list of regular expressions to the `Include` field. OpenMetadata will include all Topics with names matching one or more of the supplied regular expressions. All other Topics will be excluded.

For example, to include only those Topics whose name starts with the word `demo`, add the regex pattern in the include field as `^demo.*`.

**Exclude**: Explicitly exclude Topics by adding a list of regular expressions to the `Exclude` field. OpenMetadata will exclude all Topics with names matching one or more of the supplied regular expressions. All other Topics will be included.

For example, to exclude all Topics with the name containing the word `demo`, add regex pattern in the exclude field as `.*demo.*`.

Checkout [this](https://docs.open-metadata.org/connectors/ingestion/workflows/metadata/filter-patterns/database#database-filter-pattern) document for further examples on filter patterns.
$$

$$section
### Ingest Sample Data $(id="generateSampleData")

Set the Ingest Sample Data toggle to control whether to ingest sample data as part of the metadata ingestion.
$$

$$section
### Enable Debug Logs $(id="enableDebugLog")

Set the `Enable Debug Log` toggle to set the logging level of the process to debug. You can check these logs in the Ingestion tab of the service and dig deeper into any errors you might find.
$$

$$section
### Mark Deleted Topics $(id="markDeletedTopics")

Optional configuration to soft delete `topics` in OpenMetadata if the source `topics` are deleted. After deleting, all the associated entities like lineage, etc., with that `topic` will be deleted.
$$

$$section
### Number of Retries $(id="retries")

Times to retry the workflow in case it ends with a failure.
$$