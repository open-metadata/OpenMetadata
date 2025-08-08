---
title: createStoredProcedure
slug: /main-concepts/metadata-standard/schemas/api/data/createstoredprocedure
---

# CreateStoredProcedureRequest

*Create Stored Procedure Request*

## Properties

- **`name`**: Name of a Stored Procedure. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this Stored Procedure.
- **`description`**: Description of the Stored Procedure. Refer to *../../type/basic.json#/definitions/markdown*.
- **`owners`**: Owners of this entity. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`tags`** *(array)*: Tags for this StoredProcedure. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`storedProcedureCode`**: SQL Query definition. Refer to *../../entity/data/storedProcedure.json#/definitions/storedProcedureCode*.
- **`storedProcedureType`**: Type of the Stored Procedure. Refer to *../../entity/data/storedProcedure.json#/definitions/storedProcedureType*.
- **`databaseSchema`**: Link to the database schema fully qualified name where this stored procedure is hosted in. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *../../type/basic.json#/definitions/entityExtension*.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`sourceUrl`**: Source URL of database schema. Refer to *../../type/basic.json#/definitions/sourceUrl*.
- **`domains`** *(array)*: Fully qualified names of the domains the Stored Procedure belongs to.
  - **Items** *(string)*
- **`lifeCycle`**: Life Cycle of the entity. Refer to *../../type/lifeCycle.json*.
- **`sourceHash`** *(string)*: Source hash of the entity.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
