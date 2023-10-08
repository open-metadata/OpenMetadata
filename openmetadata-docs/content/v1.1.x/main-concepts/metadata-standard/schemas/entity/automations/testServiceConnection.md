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
- **`secretsManagerProvider`**: Refer to *../../security/secrets/secretsManagerProvider.json*. Default: `noop`.


Documentation file automatically generated at 2023-07-07 05:50:35.981927.
