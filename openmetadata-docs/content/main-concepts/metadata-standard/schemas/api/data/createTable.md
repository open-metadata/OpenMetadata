---
title: createTable
slug: /main-concepts/metadata-standard/schemas/api/data/createtable
---

# CreateTableRequest

*Schema corresponding to a table that belongs to a database*

## Properties

- **`name`**: Name that identifies the this entity instance uniquely. Same as id if when name is not unique. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this table.
- **`description`**: Description of entity instance. Refer to *../../type/basic.json#/definitions/markdown*.
- **`tableType`**: Refer to *../../entity/data/table.json#/definitions/tableType*.
- **`columns`** *(array)*: Name of the tables in the database. Default: `None`.
  - **Items**: Refer to *../../entity/data/table.json#/definitions/column*.
- **`tableConstraints`** *(array)*: Default: `None`.
  - **Items**: Refer to *../../entity/data/table.json#/definitions/tableConstraint*.
- **`tablePartition`**: Refer to *../../entity/data/table.json#/definitions/tablePartition*.
- **`profileSample`** *(number)*: Percentage of data we want to execute the profiler and tests on. Represented in the range (0, 100]. Maximum: `100`. Default: `None`.
- **`profileQuery`** *(string)*: Users' raw SQL query to fetch sample data and profile the table. Default: `None`.
- **`owner`**: Owner of this entity. Refer to *../../type/entityReference.json*. Default: `None`.
- **`databaseSchema`**: Schema corresponding to this table. Refer to *../../type/entityReference.json*. Default: `None`.
- **`tags`** *(array)*: Tags for this table. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`viewDefinition`**: View Definition in SQL. Applies to TableType.View only. Refer to *../../type/basic.json#/definitions/sqlQuery*. Default: `None`.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *../../type/basic.json#/definitions/entityExtension*.


Documentation file automatically generated at 2022-07-13 15:15:58.612083.
