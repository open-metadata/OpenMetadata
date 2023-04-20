# Metadata

MessagingService Metadata Pipeline Configuration.

## Properties

$$section

### Topic Filter Pattern $(id="topicFilterPattern")

Topic filter patterns to control whether or not to include topic as part of metadata ingestion. Enter the regex pattern form the for including or excluding the topic.
$$

$$section
### Enable Debug Logs $(id="loggerLevel")

Enabling debug logs tracks error messages during ingestion for troubleshooting.
$$

$$section
### Mark Deleted Ml Model $(id="markDeletedMlModels")

Optional configuration to soft delete 'ML models' in OpenMetadata if the source 'ML models' are deleted. After deleting, all the associated entities like lineage, etc., with that 'ML model' will be deleted.
$$