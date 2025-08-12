---
title: supersetApiConnection
slug: /main-concepts/metadata-standard/schemas/entity/utils/supersetapiconnection
---

# SupersetApiConnection

*Superset API Connection Config*

## Properties

- **`provider`**: Authentication provider for the Superset service. For basic user/password authentication, the default value `db` can be used. This parameter is used internally to connect to Superset's REST API. Refer to *#/definitions/apiProvider*. Default: `db`.
- **`username`** *(string)*: Username for Superset.
- **`password`** *(string)*: Password for Superset.
- **`verifySSL`**: Refer to *../../security/ssl/verifySSLConfig.json#/definitions/verifySSL*. Default: `no-ssl`.
- **`sslConfig`**: Refer to *../../security/ssl/verifySSLConfig.json#/definitions/sslConfig*.
## Definitions

- **`apiProvider`** *(string)*: Authentication provider for the Superset service. For basic user/password authentication, the default value `db` can be used. This parameter is used internally to connect to Superset's REST API. Must be one of: `['db', 'ldap']`. Default: `db`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
