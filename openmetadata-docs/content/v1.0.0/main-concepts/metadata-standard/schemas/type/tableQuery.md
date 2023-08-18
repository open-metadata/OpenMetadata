---
title: tableQuery
slug: /main-concepts/metadata-standard/schemas/type/tablequery
---

# Table Queries

*This schema defines structure of table query*

## Properties

- **`queries`** *(array)*: Date of execution of SQL query.
  - **Items**: Refer to *#/definitions/tableQuery*.
## Definitions

- **`tableQuery`**
  - **`query`** *(string)*: SQL query.
  - **`userName`** *(string)*: Name of the user that executed the SQL query.
  - **`startTime`** *(string)*: Start time of execution of SQL query.
  - **`endTime`** *(string)*: End time of execution of SQL query.
  - **`analysisDate`**: Date of execution of SQL query. Refer to *./basic.json#/definitions/dateTime*.
  - **`aborted`** *(boolean)*: Flag to check if query was aborted during execution.
  - **`serviceName`** *(string)*: Name that identifies this database service.
  - **`databaseName`** *(string)*: Database associated with the table in the query.
  - **`databaseSchema`** *(string)*: Database schema of the associated with query.


Documentation file automatically generated at 2022-07-14 10:51:34.749986.
