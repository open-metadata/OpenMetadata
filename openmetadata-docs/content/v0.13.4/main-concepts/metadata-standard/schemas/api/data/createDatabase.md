---
title: createDatabase
slug: /main-concepts/metadata-standard/schemas/api/data/createdatabase
---

# CreateDatabaseRequest

*Create Database entity request*

## Properties

- **`name`**: Name that identifies this database instance uniquely. Refer to *../../entity/data/database.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this database.
- **`description`**: Description of the database instance. What it has and how to use it. Refer to *../../type/basic.json#/definitions/markdown*.
- **`tags`** *(array)*: Tags for this Database Service. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`owner`**: Owner of this database. Refer to *../../type/entityReference.json*.
- **`service`**: Link to the database service fully qualified name where this database is hosted in. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`default`** *(boolean)*: Some databases don't support a database/catalog in the hierarchy and use default database. For example, `MySql`. For such databases, set this flag to true to indicate that this is a default database. Default: `False`.


Documentation file automatically generated at 2023-04-13 23:17:03.893190.
