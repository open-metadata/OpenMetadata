---
title: jdbcConnection | OpenMetadata JDBC Connection
description: JdbcConnection schema holds JDBC driver metadata and connection properties.
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

- **`driverClass`** *(string)*: Type used for JDBC driver class.
- **`connectionUrl`** *(string)*: Type used for JDBC connection URL of format `url_scheme://<username>:<password>@<host>:<port>/<db_name>`.
- **`jdbcInfo`** *(object)*: Type for capturing JDBC connector information. Cannot contain additional properties.
  - **`driverClass`**: Refer to *[#/definitions/driverClass](#definitions/driverClass)*.
  - **`connectionUrl`**: Refer to *[#/definitions/connectionUrl](#definitions/connectionUrl)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
