---
title: createTable
slug: /main-concepts/metadata-standard/schemas/api/data/createtable
---

# CreateTableRequest

*Schema corresponding to a table that belongs to a database*

## Properties

- **`name`**: Name that identifies the this entity instance uniquely. Same as id if when name is not unique. Refer to *../../entity/data/table.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this table.
- **`description`**: Description of entity instance. Refer to *../../type/basic.json#/definitions/markdown*.
- **`tableType`**: Refer to *../../entity/data/table.json#/definitions/tableType*.
- **`columns`** *(array)*: Name of the tables in the database. Default: `None`.
  - **Items**: Refer to *../../entity/data/table.json#/definitions/column*.
- **`tableConstraints`** *(array)*: Default: `None`.
  - **Items**: Refer to *../../entity/data/table.json#/definitions/tableConstraint*.
- **`tablePartition`**: Refer to *../../entity/data/table.json#/definitions/tablePartition*.
- **`tableProfilerConfig`**: Refer to *../../entity/data/table.json#/definitions/tableProfilerConfig*.
- **`owner`**: Owner of this entity. Refer to *../../type/entityReference.json*. Default: `None`.
- **`databaseSchema`**: FullyQualified name of the Schema corresponding to this table. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`tags`** *(array)*: Tags for this table. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`viewDefinition`**: View Definition in SQL. Applies to TableType.View only. Refer to *../../type/basic.json#/definitions/sqlQuery*. Default: `None`.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *../../type/basic.json#/definitions/entityExtension*.


Documentation file automatically generated at 2023-04-13 23:17:03.893190.
