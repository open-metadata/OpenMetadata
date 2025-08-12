#### Source Configuration - Source Config

{% codeInfo srNumber=100 %}

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/pipelineServiceMetadataPipeline.json):

- **dbServiceNames**: Database Service Name for the creation of lineage, if the source supports it.

- **includeTags**: Set the 'Include Tags' toggle to control whether to include tags as part of metadata ingestion.

- **includeUnDeployedPipelines**: Set the 'Include UnDeployed Pipelines' toggle to control whether to include un-deployed pipelines as part of metadata ingestion. By default it is set to `true`

- **markDeletedPipelines**: Set the Mark Deleted Pipelines toggle to flag pipelines as soft-deleted if they are not present anymore in the source system.

- **pipelineFilterPattern** and **chartFilterPattern**: Note that the `pipelineFilterPattern` and `chartFilterPattern` both support regex as include or exclude.

- **includeOwners**: Set the 'Include Owners' toggle to control whether to include owners to the ingested entity if the owner email matches with a user stored in the OM server as part of metadata ingestion. If the ingested entity already exists and has an owner, the owner will not be overwritten.It supports boolean values either `true` or `false`.

- **overrideLineage**: Set the 'Override Lineage' toggle to control whether to override the existing lineage. It supports boolean values either `true` or `false`.

- **overrideMetadata**: Set the 'Override Metadata' toggle to control whether to override the existing metadata in the OpenMetadata server with the metadata fetched from the source. If the toggle is set to true, the metadata fetched from the source will override the existing metadata in the OpenMetadata server. If the toggle is set to false, the metadata fetched from the source will not override the existing metadata in the OpenMetadata server. This is applicable for fields like description, tags, owner and displayName. It supports boolean values either `true` or `false`.

{% /codeInfo %}