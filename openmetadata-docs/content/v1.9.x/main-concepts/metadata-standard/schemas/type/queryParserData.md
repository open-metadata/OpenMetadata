---
title: queryParserData | OpenMetadata Query Parser Data
description: QueryParserData schema stores intermediate metadata parsed from SQL or query logs.
slug: /main-concepts/metadata-standard/schemas/type/queryparserdata
---

# Query Parser Data

*This schema defines type of query parser data*

## Properties

- **`parsedData`** *(array)*
  - **Items**: Refer to *[#/definitions/parsedData](#definitions/parsedData)*.
## Definitions

- **`parsedData`**
  - **`tables`** *(array, required)*: List of tables used in query.
    - **Items** *(string)*
  - **`databaseName`** *(string)*: Database associated with the table in the query.
  - **`joins`** *(object)*: Maps each parsed table name of a query to the join information. Can contain additional properties.
    - **Additional Properties**
  - **`sql`** *(string, required)*: SQL query.
  - **`dialect`** *(string)*: SQL dialect.
  - **`query_type`** *(string)*: SQL query type.
  - **`exclude_usage`** *(boolean)*: Flag to check if query is to be excluded while processing usage.
  - **`serviceName`** *(string, required)*: Name that identifies this database service.
  - **`userName`** *(string)*: Name of the user that executed the SQL query.
  - **`date`** *(string)*: Date of execution of SQL query.
  - **`databaseSchema`** *(string)*: Database schema of the associated with query.
  - **`duration`** *(number)*: How long did the query took to run in milliseconds.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
