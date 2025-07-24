---
title: Create Table API | OpenMetadata Table API
description: Define and create a new table entity with columns, constraints, relationships, and profiling metadata.
slug: /main-concepts/metadata-standard/schemas/api/data/createtable
---

# CreateTableRequest

*Schema corresponding to a table that belongs to a database*

## Properties

- **`name`**: Name that identifies the this entity instance uniquely. Same as id if when name is not unique. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name that identifies this table.
- **`description`**: Description of entity instance. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`tableType`**: Refer to *[../../entity/data/table.json#/definitions/tableType](#/../entity/data/table.json#/definitions/tableType)*.
- **`columns`** *(array)*: Name of the tables in the database. Default: `null`.
  - **Items**: Refer to *[../../entity/data/table.json#/definitions/column](#/../entity/data/table.json#/definitions/column)*.
- **`dataModel`**: Refer to *[../../entity/data/table.json#/definitions/dataModel](#/../entity/data/table.json#/definitions/dataModel)*.
- **`locationPath`** *(string)*: Full storage path in case of external and managed tables. Default: `null`.
- **`tableConstraints`** *(array)*: Default: `null`.
  - **Items**: Refer to *[../../entity/data/table.json#/definitions/tableConstraint](#/../entity/data/table.json#/definitions/tableConstraint)*.
- **`tablePartition`**: Refer to *[../../entity/data/table.json#/definitions/tablePartition](#/../entity/data/table.json#/definitions/tablePartition)*.
- **`tableProfilerConfig`**: Refer to *[../../entity/data/table.json#/definitions/tableProfilerConfig](#/../entity/data/table.json#/definitions/tableProfilerConfig)*.
- **`owners`**: Owners of this entity. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
- **`databaseSchema`**: FullyQualified name of the Schema corresponding to this table. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`tags`** *(array)*: Tags for this table. Default: `null`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`schemaDefinition`**: DDL for Tables and Views. Refer to *[../../type/basic.json#/definitions/sqlQuery](#/../type/basic.json#/definitions/sqlQuery)*. Default: `null`.
- **`retentionPeriod`**: Retention period of the data in the database. Period is expressed as duration in ISO 8601 format in UTC. Example - `P23DT23H`. Refer to *[../../type/basic.json#/definitions/duration](#/../type/basic.json#/definitions/duration)*.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *[../../type/basic.json#/definitions/entityExtension](#/../type/basic.json#/definitions/entityExtension)*.
- **`sourceUrl`**: Source URL of table. Refer to *[../../type/basic.json#/definitions/sourceUrl](#/../type/basic.json#/definitions/sourceUrl)*.
- **`domain`** *(string)*: Fully qualified name of the domain the Table belongs to.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`fileFormat`**: File format in case of file/datalake tables. Refer to *[../../entity/data/table.json#/definitions/fileFormat](#/../entity/data/table.json#/definitions/fileFormat)*.
- **`lifeCycle`**: Life Cycle of the entity. Refer to *[../../type/lifeCycle.json](#/../type/lifeCycle.json)*.
- **`sourceHash`** *(string)*: Source hash of the entity.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
