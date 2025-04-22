---
title: supersetApiConnection
slug: /main-concepts/metadata-standard/schemas/entity/utils/supersetapiconnection
---

# SupersetApiConnection

*Superset API Connection Config*

## Properties

- **`provider`**: Authentication provider for the Superset service. For basic user/password authentication, the default value `db` can be used. This parameter is used internally to connect to Superset's REST API. Refer to *[#/definitions/apiProvider](#definitions/apiProvider)*. Default: `"db"`.
- **`username`** *(string)*: Username for Superset.
- **`password`** *(string, format: password)*: Password for Superset.
- **`verifySSL`**: Refer to *[../../security/ssl/verifySSLConfig.json#/definitions/verifySSL](#/../security/ssl/verifySSLConfig.json#/definitions/verifySSL)*. Default: `"no-ssl"`.
- **`sslConfig`**: Refer to *[../../security/ssl/verifySSLConfig.json#/definitions/sslConfig](#/../security/ssl/verifySSLConfig.json#/definitions/sslConfig)*.
## Definitions

- **`apiProvider`** *(string)*: Authentication provider for the Superset service. For basic user/password authentication, the default value `db` can be used. This parameter is used internally to connect to Superset's REST API. Must be one of: `["db", "ldap"]`. Default: `"db"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
