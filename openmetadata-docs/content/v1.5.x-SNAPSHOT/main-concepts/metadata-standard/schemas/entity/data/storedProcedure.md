---
title: storedProcedure
slug: /main-concepts/metadata-standard/schemas/entity/data/storedprocedure
---

# StoredProcedure

*A `StoredProcedure` entity that contains the set of code statements with an assigned name  and is defined in a `Database Schema`."*

## Properties

- **`id`**: Unique identifier of the StoredProcedure. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Name of Stored Procedure. Refer to *#/definitions/entityName*.
- **`fullyQualifiedName`**: Fully qualified name of a Stored Procedure. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Display Name that identifies this Stored Procedure.
- **`description`**: Description of a Stored Procedure. Refer to *../../type/basic.json#/definitions/markdown*.
- **`storedProcedureCode`**: Stored Procedure Code. Refer to *#/definitions/storedProcedureCode*.
- **`version`**: Metadata version of the Stored Procedure. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the query.
- **`href`**: Link to this Query resource. Refer to *../../type/basic.json#/definitions/href*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`databaseSchema`**: Reference to Database Schema that contains this stored procedure. Refer to *../../type/entityReference.json*.
- **`database`**: Reference to Database that contains this stored procedure. Refer to *../../type/entityReference.json*.
- **`service`**: Link to Database service this table is hosted in. Refer to *../../type/entityReference.json*.
- **`serviceType`**: Service type this table is hosted in. Refer to *../services/databaseService.json#/definitions/databaseServiceType*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
- **`owner`**: Owner of this Query. Refer to *../../type/entityReference.json*. Default: `None`.
- **`followers`**: Followers of this Query. Refer to *../../type/entityReferenceList.json*.
- **`votes`**: Refer to *../../type/votes.json*.
- **`code`**: SQL Query definition. Refer to *../../type/basic.json#/definitions/sqlQuery*.
- **`tags`** *(array)*: Tags for this SQL query. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *../../type/basic.json#/definitions/entityExtension*.
- **`sourceUrl`**: Source URL of database schema. Refer to *../../type/basic.json#/definitions/sourceUrl*.
- **`domain`**: Domain the Stored Procedure belongs to. When not set, the Stored Procedure inherits the domain from the database schemna it belongs to. Refer to *../../type/entityReference.json*.
- **`lifeCycle`**: Life Cycle properties of the entity. Refer to *../../type/lifeCycle.json*.
## Definitions

- **`entityName`** *(string)*: Name of a Stored Procedure. Expected to be unique within a database schema.
- **`storedProcedureCode`**
  - **`language`** *(string)*: This schema defines the type of the language used for Stored Procedure's Code. Must be one of: `['SQL', 'Java', 'JavaScript', 'Python']`.
  - **`code`** *(string)*: This schema defines the type of the language used for Stored Procedure's Code.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
