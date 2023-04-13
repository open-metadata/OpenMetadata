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


Documentation file automatically generated at 2023-04-13 23:17:03.893190.
