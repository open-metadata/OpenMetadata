---
title: applicationPipeline
slug: /main-concepts/metadata-standard/schemas/metadataingestion/applicationpipeline
---

# ApplicationPipeline

*Application Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *#/definitions/applicationConfigType*. Default: `Application`.
- **`sourcePythonClass`** *(string)*: Source Python Class Name to run the application.
- **`appConfig`**: Application configuration. Refer to *../entity/applications/configuration/applicationConfig.json#/definitions/appConfig*.
- **`appPrivateConfig`**: Application private configuration. Refer to *../entity/applications/configuration/applicationConfig.json#/definitions/privateConfig*.
## Definitions

- **`applicationConfigType`** *(string)*: Pipeline Source Config For Application Pipeline type. Nothing is required. Must be one of: `['Application']`. Default: `Application`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
