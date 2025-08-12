---
title: testServiceConnection | Official Documentation
description: Connect Testserviceconnection to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /main-concepts/metadata-standard/schemas/entity/automations/testserviceconnection
---

# TestServiceConnectionRequest

*Test Service Connection to test user provided configuration is valid or not.*

## Properties

- **`connection`**: Connection object.
  - **One of**
    - : Refer to *[../services/apiService.json#/definitions/apiConnection](#/services/apiService.json#/definitions/apiConnection)*.
    - : Refer to *[../services/databaseService.json#/definitions/databaseConnection](#/services/databaseService.json#/definitions/databaseConnection)*.
    - : Refer to *[../services/dashboardService.json#/definitions/dashboardConnection](#/services/dashboardService.json#/definitions/dashboardConnection)*.
    - : Refer to *[../services/messagingService.json#/definitions/messagingConnection](#/services/messagingService.json#/definitions/messagingConnection)*.
    - : Refer to *[../services/pipelineService.json#/definitions/pipelineConnection](#/services/pipelineService.json#/definitions/pipelineConnection)*.
    - : Refer to *[../services/mlmodelService.json#/definitions/mlModelConnection](#/services/mlmodelService.json#/definitions/mlModelConnection)*.
    - : Refer to *[../services/metadataService.json#/definitions/metadataConnection](#/services/metadataService.json#/definitions/metadataConnection)*.
    - : Refer to *[../services/storageService.json#/definitions/storageConnection](#/services/storageService.json#/definitions/storageConnection)*.
    - : Refer to *[../services/searchService.json#/definitions/searchConnection](#/services/searchService.json#/definitions/searchConnection)*.
- **`serviceType`**: Type of service such as Database, Dashboard, Messaging, etc. Refer to *[../services/serviceType.json](#/services/serviceType.json)*.
- **`connectionType`** *(string)*: Type of the connection to test such as Snowflake, MySQL, Looker, etc.
- **`serviceName`**: Optional value that identifies this service name. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*. Default: `null`.
- **`secretsManagerProvider`**: Secrets Manager Provider to use for fetching secrets. Refer to *[../../security/secrets/secretsManagerProvider.json](#/../security/secrets/secretsManagerProvider.json)*. Default: `"db"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
