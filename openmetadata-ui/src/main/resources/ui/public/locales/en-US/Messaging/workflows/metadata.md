# Metadata

MessagingService Metadata Pipeline Configuration.

## Properties

### Topic Filter Pattern $(id="topicFilterPattern")

Topic filter patterns to control whether or not to include topic as part of metadata ingestion. Enter the regex pattern form the for including or excluding the topic.

### Ingest Sample Data $(id="generateSampleData")

Set the Ingest Sample Data toggle to control whether or not to topic sample data as part of metadata ingestion.

### Enable Debug Logs

Enabling debug logs tracks error messages during ingestion for troubleshooting.

### Mark Deleted Topics $(id="markDeletedTopics")

Optional configuration to soft delete 'topics' in OpenMetadata if the source 'topics' are deleted. After deleting, all the associated entities like lineage, etc., with that 'topic' will be deleted.