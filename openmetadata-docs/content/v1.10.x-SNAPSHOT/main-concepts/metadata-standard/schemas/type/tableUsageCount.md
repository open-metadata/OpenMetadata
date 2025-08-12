---
title: tableUsageCount
slug: /main-concepts/metadata-standard/schemas/type/tableusagecount
---

# Table Usage Count

*This model is the linking between the usage stage and bulk sink steps*

## Properties

- **`table`** *(string)*: Name of the table.
- **`date`** *(string)*: Date of execution of SQL query.
- **`databaseName`** *(string)*: Database associated with the table in the query.
- **`count`** *(integer)*: Usage count of table. Default: `1`.
- **`databaseSchema`** *(string)*: Database schema of the associated with table.
- **`sqlQueries`** *(array)*: List of SQL Queries associated with table.
  - **Items**: Refer to *../api/data/createQuery.json*.
- **`joins`** *(array)*: List of joins associated with table.
  - **Items**: Refer to *#/definitions/tableColumnJoin*.
- **`serviceName`** *(string)*: Name that identifies this database service.
## Definitions

- **`tableColumn`** *(object)*: Cannot contain additional properties.
  - **`table`** *(string)*: Name of the table.
  - **`column`** *(string)*: Name of the column.
- **`tableColumnJoin`** *(object)*: Cannot contain additional properties.
  - **`tableColumn`**: Source table column. Refer to *#/definitions/tableColumn*.
  - **`joinedWith`** *(array)*: List of table columns with which the table is joined with.
    - **Items**: Refer to *#/definitions/tableColumn*.
- **`queryCostWrapper`** *(object)*: Cannot contain additional properties.
  - **`cost`** *(number)*: Avg query cost per execution.
  - **`count`** *(number)*: Number of times the query was executed.
  - **`date`** *(string)*: Date of execution of SQL query.
  - **`queryHash`** *(string)*: Hash of the query.
  - **`query`** *(string)*: SQL query.
  - **`dialect`** *(string)*: SQL dialect.
  - **`totalDuration`** *(number)*: Total duration of the query.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
