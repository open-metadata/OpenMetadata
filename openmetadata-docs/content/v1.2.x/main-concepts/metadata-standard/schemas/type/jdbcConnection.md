---
title: jdbcConnection
slug: /main-concepts/metadata-standard/schemas/type/jdbcconnection
---

# JDBC connection

*This schema defines the type used for JDBC connection information.*

## Properties

- **`driverClass`**: JDBC driver class. Refer to *[#/definitions/driverClass](#definitions/driverClass)*.
- **`connectionUrl`**: JDBC connection URL. Refer to *[#/definitions/connectionUrl](#definitions/connectionUrl)*.
- **`userName`** *(string)*: Login user name.
- **`password`** *(string)*: Login password.
## Definitions

- <a id="definitions/driverClass"></a>**`driverClass`** *(string)*: Type used for JDBC driver class.
- <a id="definitions/connectionUrl"></a>**`connectionUrl`** *(string)*: Type used for JDBC connection URL of format `url_scheme://<username>:<password>@<host>:<port>/<db_name>`.
- <a id="definitions/jdbcInfo"></a>**`jdbcInfo`** *(object)*: Type for capturing JDBC connector information. Cannot contain additional properties.
  - **`driverClass`**: Refer to *[#/definitions/driverClass](#definitions/driverClass)*.
  - **`connectionUrl`**: Refer to *[#/definitions/connectionUrl](#definitions/connectionUrl)*.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
