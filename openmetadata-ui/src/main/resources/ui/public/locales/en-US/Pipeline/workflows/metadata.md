# Metadata

Pipeline Service Metadata Pipeline Configuration.

## Configuration

$$section

### Pipeline Filter Pattern $(id="pipelineFilterPattern")

Pipeline filter patterns are used to control whether to include Pipelines as part of metadata ingestion.

**Include**: Explicitly include Pipelines by adding a list of regular expressions to the `Include` field. OpenMetadata will include all Pipelines with names matching one or more of the supplied regular expressions. All other Pipelines will be excluded.

For example, to include only those Pipelines whose name starts with the word `demo`, add the regex pattern in the include field as `^demo.*`.

**Exclude**: Explicitly exclude Pipelines by adding a list of regular expressions to the `Exclude` field. OpenMetadata will exclude all Pipelines with names matching one or more of the supplied regular expressions. All other Pipelines will be included.

For example, to exclude all Pipelines with the name containing the word `demo`, add regex pattern in the exclude field as `.*demo.*`.

Checkout [this](https://docs.open-metadata.org/connectors/ingestion/workflows/metadata/filter-patterns/database#database-filter-pattern) document for further examples on filter patterns.
$$

$$section
### Database Service Name $(id="dbServiceNames")

When processing Pipelines we can extract information about the inlet and the outlet tables.

In order to create the lineage between the inlet and the outlet tables, we need to know where to look for such tables.

You can enter a list of Database Services that are hosting the inlet and the outlet tables.
$$

$$section
### Include Lineage $(id="includeLineage")

Set the Include Lineage toggle to control whether to include lineage between pipelines and data sources as part of metadata ingestion.
$$

$$section
### Enable Debug Logs $(id="enableDebugLog")

Set the `Enable Debug Log` toggle to set the logging level of the process to debug. You can check these logs in the Ingestion tab of the service and dig deeper into any errors you might find.
$$

$$section
### Include Tags $(id="includeTags")

Set the Include tags toggle to control whether to include tags as part of metadata ingestion.
$$

$$section
### Mark Deleted Pipelines $(id="markDeletedPipeline")

Optional configuration to soft delete `pipelines` in OpenMetadata if the source `pipelines` are deleted. After deleting, all the associated entities like lineage, etc., with that `pipeline` will be deleted.
$$

$$section
### Number of Retries $(id="retries")

Times to retry the workflow in case it ends with a failure.
$$