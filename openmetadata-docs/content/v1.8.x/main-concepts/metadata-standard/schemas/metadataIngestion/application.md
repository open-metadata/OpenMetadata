---
title: application | OpenMetadata Application Ingestion
description: Connect Application to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /main-concepts/metadata-standard/schemas/metadataingestion/application
---

# OpenMetadataApplicationConfig

*OpenMetadata Ingestion Framework definition for Applications, i.e., the YAML shape we require.*

## Properties

- **`workflowConfig`**: General Workflow configuration, such as the OpenMetadata server connection and logging level. Refer to *[workflow.json#/definitions/workflowConfig](#rkflow.json#/definitions/workflowConfig)*.
- **`sourcePythonClass`** *(string)*: Source Python Class Name to run the application.
- **`appConfig`**: External Application configuration. Refer to *[../entity/applications/configuration/applicationConfig.json#/definitions/appConfig](#/entity/applications/configuration/applicationConfig.json#/definitions/appConfig)*.
- **`appPrivateConfig`**: External Application Private configuration. Refer to *[../entity/applications/configuration/applicationConfig.json#/definitions/privateConfig](#/entity/applications/configuration/applicationConfig.json#/definitions/privateConfig)*.
- **`ingestionPipelineFQN`** *(string)*: Fully qualified name of ingestion pipeline, used to identify the current ingestion pipeline.
- **`pipelineRunId`**: Unique identifier of pipeline run, used to identify the current pipeline run. Refer to *[../type/basic.json#/definitions/uuid](#/type/basic.json#/definitions/uuid)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
