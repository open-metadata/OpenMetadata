---
title: createPipelineService
slug: /main-concepts/metadata-standard/schemas/api/services/createpipelineservice
---

# CreatePipelineServiceRequest

*Create Pipeline service entity request*

## Properties

- **`name`**: Name that identifies the this entity instance uniquely. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this pipeline service.
- **`description`**: Description of pipeline service entity. Refer to *../../type/basic.json#/definitions/markdown*.
- **`serviceType`**: Refer to *../../entity/services/pipelineService.json#/definitions/pipelineServiceType*.
- **`connection`**: Refer to *../../entity/services/pipelineService.json#/definitions/pipelineConnection*.
- **`tags`** *(array)*: Tags for this Pipeline Service. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`owners`**: Owners of this pipeline service. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`scheduleInterval`** *(string)*: Scheduler Interval for the pipeline in cron format. Default: `None`.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`domains`** *(array)*: Fully qualified names of the domains the Pipeline Service belongs to.
  - **Items** *(string)*
- **`lifeCycle`**: Life Cycle of the entity. Refer to *../../type/lifeCycle.json*.
- **`ingestionRunner`**: The ingestion agent responsible for executing the ingestion pipeline. Refer to *../../type/entityReference.json*.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
