# Metadata

PipelineService Metadata Pipeline Configuration.

## Properties

$$section

### Pipeline Filter Pattern $(id="pipelineFilterPattern")

Pipeline filter patterns to control whether or not to include pipeline as part of metadata ingestion.

**Include**: Explicitly include pipelines by adding a list of comma-separated regular expressions to the `Include` field. OpenMetadata will include all pipelines with names matching one or more of the supplied regular expressions. All other pipelines will be excluded. 

for example, to include only those pipelines for which the name starts with the word `demo`, add regex pattern in include field as `^demo.*`.

**Exclude**: Explicitly exclude pipelines by adding a list of comma-separated regular expressions to the `Exclude` field. OpenMetadata will exclude all pipelines with names matching one or more of the supplied regular expressions. All other pipelines will be included.

for example, to exclude all pipelines with the name containing the word `demo`, add regex pattern in exclude field as `.*demo.*`.

Checkout [this](https://docs.open-metadata.org/connectors/ingestion/workflows/metadata/filter-patterns/database) document for more examples on filter patterns
$$

$$section
### Include Lineage $(id="includeLineage")

Set the Include Lineage toggle to control whether or not to include lineage between pipelines and data sources as part of metadata ingestion.
$$

$$section
### Enable Debug Logs $(id="loggerLevel")

Set the `Enable Debug Log` toggle to set the default log level to debug, these logs can be viewed later in Airflow.
$$

$$section
### Include Tags  $(id="includeTags")

Set the Include tags toggle to control whether or not to include tags as part of metadata ingestion.
$$

$$section
### Mark Deleted Pipelines $(id="markDeletedPipeline")

Optional configuration to soft delete 'pipelines' in OpenMetadata if the source 'pipelines' are deleted. After deleting, all the associated entities like lineage, etc., with that 'pipeline' will be deleted.
$$