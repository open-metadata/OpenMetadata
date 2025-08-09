---
title: jdbcConnection
slug: /main-concepts/metadata-standard/schemas/type/jdbcconnection
---

# JDBC connection

*This schema defines the type used for JDBC connection information.*

## Properties

- **`driverClass`**: JDBC driver class. Refer to *#/definitions/driverClass*.
- **`connectionUrl`**: JDBC connection URL. Refer to *#/definitions/connectionUrl*.
- **`userName`** *(string)*: Login user name.
- **`password`** *(string)*: Login password.
## Definitions

- **`driverClass`** *(string)*: Type used for JDBC driver class.
- **`connectionUrl`** *(string)*: Type used for JDBC connection URL of format `url_scheme://<username>:<password>@<host>:<port>/<db_name>`.
- **`jdbcInfo`** *(object)*: Type for capturing JDBC connector information. Cannot contain additional properties.
  - **`driverClass`**: Refer to *#/definitions/driverClass*.
  - **`connectionUrl`**: Refer to *#/definitions/connectionUrl*.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
