---
title: createDatabase
slug: /main-concepts/metadata-standard/schemas/api/data/createdatabase
---

# CreateDatabaseRequest

*Create Database entity request*

## Properties

- **`name`**: Name that identifies this database instance uniquely. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this database.
- **`description`**: Description of the database instance. What it has and how to use it. Refer to *../../type/basic.json#/definitions/markdown*.
- **`owner`**: Owner of this database. Refer to *../../type/entityReference.json*.
- **`service`**: Link to the database service where this database is hosted in. Refer to *../../type/entityReference.json*.
- **`default`** *(boolean)*: Some databases don't support a database/catalog in the hierarchy and use default database. For example, `MySql`. For such databases, set this flag to true to indicate that this is a default database. Default: `False`.


Documentation file automatically generated at 2022-07-13 15:15:58.612083.
