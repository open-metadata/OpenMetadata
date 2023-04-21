# Metadata

MessagingService Metadata Pipeline Configuration.

## Properties

$$section

### Topic Filter Pattern $(id="topicFilterPattern")

Topic filter patterns to control whether or not to include topic as part of metadata ingestion.

**Include**: Explicitly include topics by adding a list of comma-separated regular expressions to the `Include` field. OpenMetadata will include all topics with names matching one or more of the supplied regular expressions. All other topics will be excluded. 

for example, to include only those topics for which the name starts with the word `demo`, add regex pattern in include field as `^demo.*`.

**Exclude**: Explicitly exclude topics by adding a list of comma-separated regular expressions to the `Exclude` field. OpenMetadata will exclude all topics with names matching one or more of the supplied regular expressions. All other topics will be included.

for example, to exclude all topics with the name containing the word `demo`, add regex pattern in exclude field as `.*demo.*`.

Checkout [this](https://docs.open-metadata.org/connectors/ingestion/workflows/metadata/filter-patterns/database) document for more examples on filter patterns
$$

$$section
### Ingest Sample Data $(id="generateSampleData")

Set the Ingest Sample Data toggle to control whether or not to topic sample data as part of metadata ingestion.
$$

$$section
### Enable Debug Logs $(id="loggerLevel")

Set the `Enable Debug Log` toggle to set the default log level to debug, these logs can be viewed later in Airflow.
$$

$$section
### Mark Deleted Topics $(id="markDeletedTopics")

Optional configuration to soft delete 'topics' in OpenMetadata if the source 'topics' are deleted. After deleting, all the associated entities like lineage, etc., with that 'topic' will be deleted.
$$