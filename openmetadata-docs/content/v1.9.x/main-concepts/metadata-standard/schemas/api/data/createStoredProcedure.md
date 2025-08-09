---
title: createStoredProcedure | Official Documentation
description: Connect Createstoredprocedure to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /main-concepts/metadata-standard/schemas/api/data/createstoredprocedure
---

# CreateStoredProcedureRequest

*Create Stored Procedure Request*

## Properties

- **`name`**: Name of a Stored Procedure. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name that identifies this Stored Procedure.
- **`description`**: Description of the Stored Procedure. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`owners`**: Owners of this entity. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
- **`tags`** *(array)*: Tags for this StoredProcedure. Default: `null`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`storedProcedureCode`**: SQL Query definition. Refer to *[../../entity/data/storedProcedure.json#/definitions/storedProcedureCode](#/../entity/data/storedProcedure.json#/definitions/storedProcedureCode)*.
- **`storedProcedureType`**: Type of the Stored Procedure. Refer to *[../../entity/data/storedProcedure.json#/definitions/storedProcedureType](#/../entity/data/storedProcedure.json#/definitions/storedProcedureType)*.
- **`databaseSchema`**: Link to the database schema fully qualified name where this stored procedure is hosted in. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *[../../type/basic.json#/definitions/entityExtension](#/../type/basic.json#/definitions/entityExtension)*.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`sourceUrl`**: Source URL of database schema. Refer to *[../../type/basic.json#/definitions/sourceUrl](#/../type/basic.json#/definitions/sourceUrl)*.
- **`domain`** *(string)*: Fully qualified name of the domain the Stored Procedure belongs to.
- **`lifeCycle`**: Life Cycle of the entity. Refer to *[../../type/lifeCycle.json](#/../type/lifeCycle.json)*.
- **`sourceHash`** *(string)*: Source hash of the entity.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
