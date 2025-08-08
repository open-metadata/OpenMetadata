---
title: testServiceConnection
slug: /main-concepts/metadata-standard/schemas/entity/automations/testserviceconnection
---

# TestServiceConnectionRequest

*Test Service Connection to test user provided configuration is valid or not.*

## Properties

- **`connection`**: Connection object.
- **`serviceType`**: Type of service such as Database, Dashboard, Messaging, etc. Refer to *../services/serviceType.json*.
- **`connectionType`** *(string)*: Type of the connection to test such as Snowflake, MySQL, Looker, etc.
- **`serviceName`**: Optional value that identifies this service name. Refer to *../../type/basic.json#/definitions/entityName*. Default: `None`.
- **`secretsManagerProvider`**: Secrets Manager Provider to use for fetching secrets. Refer to *../../security/secrets/secretsManagerProvider.json*. Default: `db`.
- **`ingestionRunner`** *(string)*: Optional value of the ingestion runner name responsible for running the test.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
