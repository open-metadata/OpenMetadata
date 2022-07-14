---
title: queryParserData
slug: /main-concepts/metadata-standard/schemas/type/queryparserdata
---

# Query Parser Data

*This schema defines type of query parser data*

## Properties

- **`parsedData`** *(array)*
  - **Items**: Refer to *#/definitions/parsedData*.
## Definitions

- **`parsedData`**
  - **`tables`** *(array)*: List of tables used in query.
    - **Items** *(string)*
  - **`databaseName`** *(string)*: Database associated with the table in the query.
  - **`joins`** *(object)*: Maps each parsed table name of a query to the join information. Can contain additional properties.
    - **Additional Properties**
  - **`sql`** *(string)*: SQL query.
  - **`serviceName`** *(string)*: Name that identifies this database service.
  - **`date`** *(string)*: Date of execution of SQL query.
  - **`databaseSchema`** *(string)*: Database schema of the associated with query.


Documentation file automatically generated at 2022-07-13 15:15:58.612083.
