---
title: createDatabaseSchema
slug: /main-concepts/metadata-standard/schemas/api/data/createdatabaseschema
---

# CreateDatabaseSchemaRequest

*Create Database Schema entity request*

## Properties

- **`name`**: Name that identifies this database schema instance uniquely. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this database schema.
- **`description`**: Description of the schema instance. What it has and how to use it. Refer to *../../type/basic.json#/definitions/markdown*.
- **`owners`**: Owners of this schema. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`database`**: Link to the database fully qualified name where this schema is hosted in. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`tags`** *(array)*: Tags for this table. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`retentionPeriod`**: Retention period of the data in the database. Period is expressed as duration in ISO 8601 format in UTC. Example - `P23DT23H`. Refer to *../../type/basic.json#/definitions/duration*.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *../../type/basic.json#/definitions/entityExtension*.
- **`sourceUrl`**: Source URL of database schema. Refer to *../../type/basic.json#/definitions/sourceUrl*.
- **`domains`** *(array)*: Fully qualified names of the domains the Database Schema belongs to.
  - **Items** *(string)*
- **`lifeCycle`**: Life Cycle of the entity. Refer to *../../type/lifeCycle.json*.
- **`sourceHash`** *(string)*: Source hash of the entity.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
