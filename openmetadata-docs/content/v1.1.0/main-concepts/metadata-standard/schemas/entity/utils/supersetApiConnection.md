---
title: supersetApiConnection
slug: /main-concepts/metadata-standard/schemas/entity/utils/supersetapiconnection
---

# SupersetApiConnection

*Superset API Connection Config*

## Properties

- **`provider`**: Authentication provider for the Superset service. For basic user/password authentication, the default value `db` can be used. This parameter is used internally to connect to Superset's REST API. Refer to *[#/definitions/apiProvider](#definitions/apiProvider)*. Default: `"db"`.
- **`username`** *(string)*: Username for Superset.
- **`password`** *(string)*: Password for Superset.
## Definitions

- <a id="definitions/apiProvider"></a>**`apiProvider`** *(string)*: Authentication provider for the Superset service. For basic user/password authentication, the default value `db` can be used. This parameter is used internally to connect to Superset's REST API. Must be one of: `["db", "ldap"]`. Default: `"db"`.


Documentation file automatically generated at 2023-07-16 19:59:36.193714.
