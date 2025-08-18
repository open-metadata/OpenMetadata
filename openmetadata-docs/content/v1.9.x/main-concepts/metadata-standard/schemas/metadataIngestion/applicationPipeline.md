---
title: applicationPipeline | OpenMetadata Application Pipeline
description: Connect Applicationpipeline to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /main-concepts/metadata-standard/schemas/metadataingestion/applicationpipeline
---

# ApplicationPipeline

*Application Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *[#/definitions/applicationConfigType](#definitions/applicationConfigType)*. Default: `"Application"`.
- **`sourcePythonClass`** *(string)*: Source Python Class Name to run the application.
- **`appConfig`**: Application configuration. Refer to *[../entity/applications/configuration/applicationConfig.json#/definitions/appConfig](#/entity/applications/configuration/applicationConfig.json#/definitions/appConfig)*.
- **`appPrivateConfig`**: Application private configuration. Refer to *[../entity/applications/configuration/applicationConfig.json#/definitions/privateConfig](#/entity/applications/configuration/applicationConfig.json#/definitions/privateConfig)*.
## Definitions

- **`applicationConfigType`** *(string)*: Pipeline Source Config For Application Pipeline type. Nothing is required. Must be one of: `["Application"]`. Default: `"Application"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
