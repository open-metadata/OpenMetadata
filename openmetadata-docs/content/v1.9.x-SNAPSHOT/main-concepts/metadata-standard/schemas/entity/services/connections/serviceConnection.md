---
title: Service Connection | OpenMetadataService Connection
description: Schema for generic service connection metadata with protocol, host, authentication, and test endpoint.
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/serviceconnection
---

# Service Connection

*Groups source connection configurations.*

## Properties

- **`serviceConnection`**: Service Connection. Refer to *[#/definitions/serviceConnection](#definitions/serviceConnection)*.
## Definitions

- **`serviceConnection`**: Supported services.
  - **One of**
    - : Refer to *[../apiService.json#/definitions/apiConnection](#/apiService.json#/definitions/apiConnection)*.
    - : Refer to *[../dashboardService.json#/definitions/dashboardConnection](#/dashboardService.json#/definitions/dashboardConnection)*.
    - : Refer to *[../databaseService.json#/definitions/databaseConnection](#/databaseService.json#/definitions/databaseConnection)*.
    - : Refer to *[../messagingService.json#/definitions/messagingConnection](#/messagingService.json#/definitions/messagingConnection)*.
    - : Refer to *[../metadataService.json#/definitions/metadataConnection](#/metadataService.json#/definitions/metadataConnection)*.
    - : Refer to *[../pipelineService.json#/definitions/pipelineConnection](#/pipelineService.json#/definitions/pipelineConnection)*.
    - : Refer to *[../mlmodelService.json#/definitions/mlModelConnection](#/mlmodelService.json#/definitions/mlModelConnection)*.
    - : Refer to *[../storageService.json#/definitions/storageConnection](#/storageService.json#/definitions/storageConnection)*.
    - : Refer to *[../searchService.json#/definitions/searchConnection](#/searchService.json#/definitions/searchConnection)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
