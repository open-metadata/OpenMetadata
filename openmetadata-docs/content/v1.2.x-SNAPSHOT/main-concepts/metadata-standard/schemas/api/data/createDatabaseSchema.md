---
title: createDatabaseSchema
slug: /main-concepts/metadata-standard/schemas/api/data/createdatabaseschema
---

# CreateDatabaseSchemaRequest

*Create Database Schema entity request*

## Properties

- **`name`**: Name that identifies this database schema instance uniquely. Refer to *../../entity/data/databaseSchema.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this database schema.
- **`description`**: Description of the schema instance. What it has and how to use it. Refer to *../../type/basic.json#/definitions/markdown*.
- **`owner`**: Owner of this schema. Refer to *../../type/entityReference.json*.
- **`database`**: Link to the database fully qualified name where this schema is hosted in. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`tags`** *(array)*: Tags for this table. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`retentionPeriod`**: Retention period of the data in the database. Period is expressed as duration in ISO 8601 format in UTC. Example - `P23DT23H`. Refer to *../../type/basic.json#/definitions/duration*.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *../../type/basic.json#/definitions/entityExtension*.
- **`domain`** *(string)*: Fully qualified name of the domain the Database Schema belongs to.


Documentation file automatically generated at 2023-07-07 05:50:35.981927.
