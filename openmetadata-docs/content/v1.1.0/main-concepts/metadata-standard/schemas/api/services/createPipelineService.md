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
- **`owner`**: Owner of this pipeline service. Refer to *../../type/entityReference.json*.
- **`scheduleInterval`** *(string)*: Scheduler Interval for the pipeline in cron format. Default: `None`.
- **`domain`** *(string)*: Fully qualified name of the domain the Pipeline Service belongs to.


Documentation file automatically generated at 2023-07-07 05:50:35.981927.
