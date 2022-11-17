---
title: testServiceConnection
slug: /main-concepts/metadata-standard/schemas/api/services/ingestionpipelines/testserviceconnection
---

# TestServiceConnectionRequest

*Test Service Connection to test user provided configuration is valid or not.*

## Properties

- **`connection`**: Connection object.
- **`connectionType`** *(string)*: Type of service such as Database, Dashboard, Messaging, etc. Must be one of: `['Database', 'Dashboard', 'Messaging', 'Pipeline', 'MlModel', 'Metadata']`.
- **`secretsManagerProvider`**: Refer to *../../../entity/services/connections/metadata/secretsManagerProvider.json*.


Documentation file automatically generated at 2022-11-17 03:44:30.373132.
