---
title: fivetranConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/pipeline/fivetranconnection
---

# FivetranConnection

*Fivetran Metadata Database Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/FivetranType*. Default: `Fivetran`.
- **`apiKey`** *(string)*: Fivetran API Secret.
- **`hostPort`** *(string)*: Pipeline Service Management/UI URI. Default: `https://api.fivetran.com`.
- **`apiSecret`** *(string)*: Fivetran API Secret.
- **`limit`** *(integer)*: Fivetran API Limit For Pagination. Default: `1000`.
- **`pipelineFilterPattern`**: Regex exclude pipelines. Refer to *../../../../type/filterPattern.json#/definitions/filterPattern*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`FivetranType`** *(string)*: Service type. Must be one of: `['Fivetran']`. Default: `Fivetran`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
