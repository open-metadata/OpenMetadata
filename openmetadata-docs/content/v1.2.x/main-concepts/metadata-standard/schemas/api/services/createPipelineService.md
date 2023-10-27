---
title: createPipelineService
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
- **`owner`**: Owner of this pipeline service. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`scheduleInterval`** *(string)*: Scheduler Interval for the pipeline in cron format. Default: `null`.
- **`domain`** *(string)*: Fully qualified name of the domain the Pipeline Service belongs to.
- **`lifeCycle`**: Life Cycle of the entity. Refer to *[../../type/lifeCycle.json](#/../type/lifeCycle.json)*.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
