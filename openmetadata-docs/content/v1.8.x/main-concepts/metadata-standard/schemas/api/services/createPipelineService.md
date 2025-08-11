---
title: Create Pipeline Service | OpenMetadataPipeline Service
description: Register a pipeline service to track and manage data pipeline metadata including lineage, tasks, and execution context.
slug: /main-concepts/metadata-standard/schemas/api/services/createpipelineservice
---

# CreatePipelineServiceRequest

*Create Pipeline service entity request*

## Properties

- **`name`**: Name that identifies the this entity instance uniquely. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name that identifies this pipeline service.
- **`description`**: Description of pipeline service entity. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`serviceType`**: Refer to *[../../entity/services/pipelineService.json#/definitions/pipelineServiceType](#/../entity/services/pipelineService.json#/definitions/pipelineServiceType)*.
- **`connection`**: Refer to *[../../entity/services/pipelineService.json#/definitions/pipelineConnection](#/../entity/services/pipelineService.json#/definitions/pipelineConnection)*.
- **`tags`** *(array)*: Tags for this Pipeline Service. Default: `null`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`owners`**: Owners of this pipeline service. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
- **`scheduleInterval`** *(string)*: Scheduler Interval for the pipeline in cron format. Default: `null`.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`domain`** *(string)*: Fully qualified name of the domain the Pipeline Service belongs to.
- **`lifeCycle`**: Life Cycle of the entity. Refer to *[../../type/lifeCycle.json](#/../type/lifeCycle.json)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
