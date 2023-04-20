# Metadata

PipelineService Metadata Pipeline Configuration.

## Properties

$$section

### Pipeline Filter Pattern $(id="pipelineFilterPattern")

Pipeline filter patterns to control whether or not to include pipeline as part of metadata ingestion. Enter the regex pattern form the for including or excluding the pipeline.

$$

$$section

### Include Lineage $(id="includeLineage")

Set the Include Lineage toggle to control whether or not to include lineage between pipelines and data sources as part of metadata ingestion.

$$

$$section

### Enable Debug Logs

Enabling debug logs tracks error messages during ingestion for troubleshooting.

$$

$$section

### Include Tags  $(id="includeTags")

Set the Include tags toggle to control whether or not to include tags as part of metadata ingestion.    

$$

$$section

### Mark Deleted Pipelines $(id="markDeletedPipeline")

Optional configuration to soft delete 'pipelines' in OpenMetadata if the source 'pipelines' are deleted. After deleting, all the associated entities like lineage, etc., with that 'pipeline' will be deleted.

$$