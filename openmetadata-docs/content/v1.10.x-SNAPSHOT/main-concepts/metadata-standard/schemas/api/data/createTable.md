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
- **`columns`** *(array)*: Name of the tables in the database.
  - **Items**: Refer to *../../entity/data/table.json#/definitions/column*.
- **`dataModel`**: Refer to *../../entity/data/table.json#/definitions/dataModel*.
- **`locationPath`** *(string)*: Full storage path in case of external and managed tables. Default: `None`.
- **`tableConstraints`** *(array)*: Default: `None`.
  - **Items**: Refer to *../../entity/data/table.json#/definitions/tableConstraint*.
- **`tablePartition`**: Refer to *../../entity/data/table.json#/definitions/tablePartition*.
- **`tableProfilerConfig`**: Refer to *../../entity/data/table.json#/definitions/tableProfilerConfig*.
- **`owners`**: Owners of this entity. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`databaseSchema`**: FullyQualified name of the Schema corresponding to this table. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`tags`** *(array)*: Tags for this table. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`schemaDefinition`**: DDL for Tables and Views. Refer to *../../type/basic.json#/definitions/sqlQuery*. Default: `None`.
- **`retentionPeriod`**: Retention period of the data in the database. Period is expressed as duration in ISO 8601 format in UTC. Example - `P23DT23H`. Refer to *../../type/basic.json#/definitions/duration*.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *../../type/basic.json#/definitions/entityExtension*.
- **`sourceUrl`**: Source URL of table. Refer to *../../type/basic.json#/definitions/sourceUrl*.
- **`domains`** *(array)*: Fully qualified names of the domains the Table belongs to.
  - **Items** *(string)*
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`fileFormat`**: File format in case of file/datalake tables. Refer to *../../entity/data/table.json#/definitions/fileFormat*.
- **`lifeCycle`**: Life Cycle of the entity. Refer to *../../type/lifeCycle.json*.
- **`sourceHash`** *(string)*: Source hash of the entity.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
