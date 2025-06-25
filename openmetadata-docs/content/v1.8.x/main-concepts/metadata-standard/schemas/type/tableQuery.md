---
title: tableQuery
slug: /main-concepts/metadata-standard/schemas/type/tablequery
---

# Table Queries

*This schema defines structure of table query*

## Properties

- **`queries`** *(array)*: Date of execution of SQL query.
  - **Items**: Refer to *[#/definitions/tableQuery](#definitions/tableQuery)*.
## Definitions

- **`tableQuery`**
  - **`query`** *(string, required)*: SQL query.
  - **`query_type`** *(string)*: SQL query type.
  - **`exclude_usage`** *(boolean)*: Flag to check if query is to be excluded while processing usage.
  - **`dialect`** *(string)*: SQL dialect.
  - **`userName`** *(string)*: Name of the user that executed the SQL query.
  - **`startTime`** *(string)*: Start time of execution of SQL query.
  - **`endTime`** *(string)*: End time of execution of SQL query.
  - **`analysisDate`**: Date of execution of SQL query. Refer to *[./basic.json#/definitions/dateTime](#basic.json#/definitions/dateTime)*.
  - **`aborted`** *(boolean)*: Flag to check if query was aborted during execution.
  - **`serviceName`** *(string, required)*: Name that identifies this database service.
  - **`databaseName`** *(string)*: Database associated with the table in the query.
  - **`databaseSchema`** *(string)*: Database schema of the associated with query.
  - **`duration`** *(number)*: How long did the query took to run in milliseconds.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
