#### Source Configuration - Source Config

{% codeInfo srNumber=100 %}

The `sourceConfig` is defined [here](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-spec/src/main/resources/json/schema/metadataIngestion/dashboardServiceMetadataPipeline.json):

- **dbServiceNames**: Database Service Names for ingesting lineage if the source supports it.

- **dashboardFilterPattern**, **chartFilterPattern**, **dataModelFilterPattern**: Note that all of them support regex as include or exclude. E.g., "My dashboard, My dash.*, .*Dashboard".

- **projectFilterPattern**: Filter the dashboards, charts and data sources by projects. Note that all of them support regex as include or exclude. E.g., "My project, My proj.*, .*Project".

- **includeOwners**: Set the 'Include Owners' toggle to control whether to include owners to the ingested entity if the owner email matches with a user stored in the OM server as part of metadata ingestion. If the ingested entity already exists and has an owner, the owner will not be overwritten.

- **includeTags**: Set the 'Include Tags' toggle to control whether to include tags in metadata ingestion.

- **includeDataModels**: Set the 'Include Data Models' toggle to control whether to include tags as part of metadata ingestion.

- **markDeletedDashboards**: Set the 'Mark Deleted Dashboards' toggle to flag dashboards as soft-deleted if they are not present anymore in the source system.

- **Include Draft Dashboard (toogle)**: Set the 'Include Draft Dashboard' toggle to include draft dashboards. By default it will include draft dashboards.

- **dataModelFilterPattern**: Regex exclude or include data models that matches the pattern.

- **includeOwners**:Enabling a flag will replace the current owner with a new owner from the source during metadata ingestion, if the current owner is null. It is recommended to keep the flag enabled to obtain the owner information during the first metadata ingestion.`includeOwners` supports boolean value either true or false.

- **markDeletedDashboards**: Optional configuration to soft delete dashboards in OpenMetadata if the source dashboards are deleted. Also, if the dashboard is deleted, all the associated entities like lineage, etc., with that dashboard will be deleted.`markDeletedDashboards` supports boolean value either true or false.

- **markDeletedDataModels**: Optional configuration to soft delete data models in OpenMetadata if the source data models are deleted. Also, if the data models is deleted, all the associated entities like lineage, etc., with that data models will be deleted.`includeOwners` supports boolean value either true or false.

- **includeTags**:Optional configuration to toggle the tags ingestion.`markDeletedDataModels` supports boolean value either true or false.

- **includeDataModels**: Optional configuration to toggle the ingestion of data models.`includeDataModels` supports boolean value either true or false.

- **includeDraftDashboard**: Optional Configuration to include/exclude draft dashboards. By default it will include draft dashboards.`includeDraftDashboard` supports boolean value either true or false.

- **overrideMetadata**: Set the 'Override Metadata' toggle to control whether to override the existing metadata in the OpenMetadata server with the metadata fetched from the source. If the toggle is set to true, the metadata fetched from the source will override the existing metadata in the OpenMetadata server. If the toggle is set to false, the metadata fetched from the source will not override the existing metadata in the OpenMetadata server. This is applicable for fields like description, tags, owner and displayName.`overrideMetadata` supports boolean value either true or false.

- **overrideLineage**: Set the 'Override Lineage' toggle to control whether to override the existing lineage.`overrideLineage` supports boolean value either true or false.

{% /codeInfo %}