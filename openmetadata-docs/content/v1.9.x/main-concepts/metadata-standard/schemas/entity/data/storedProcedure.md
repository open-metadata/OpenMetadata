---
title: Stored Procedure | OpenMetadata Stored Procedures
description: Connect Storedprocedure to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /main-concepts/metadata-standard/schemas/entity/data/storedprocedure
---

# StoredProcedure

*A `StoredProcedure` entity that contains the set of code statements with an assigned name  and is defined in a `Database Schema`."*

## Properties

- **`id`**: Unique identifier of the StoredProcedure. Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`name`**: Name of Stored Procedure. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`fullyQualifiedName`**: Fully qualified name of a Stored Procedure. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`displayName`** *(string)*: Display Name that identifies this Stored Procedure.
- **`description`**: Description of a Stored Procedure. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`storedProcedureCode`**: Stored Procedure Code. Refer to *[#/definitions/storedProcedureCode](#definitions/storedProcedureCode)*.
- **`version`**: Metadata version of the Stored Procedure. Refer to *[../../type/entityHistory.json#/definitions/entityVersion](#/../type/entityHistory.json#/definitions/entityVersion)*.
- **`dataProducts`**: List of data products this entity is part of. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`storedProcedureType`**: Type of the Stored Procedure. Refer to *[#/definitions/storedProcedureType](#definitions/storedProcedureType)*. Default: `"StoredProcedure"`.
- **`updatedBy`** *(string)*: User who made the query.
- **`href`**: Link to this Query resource. Refer to *[../../type/basic.json#/definitions/href](#/../type/basic.json#/definitions/href)*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *[../../type/entityHistory.json#/definitions/changeDescription](#/../type/entityHistory.json#/definitions/changeDescription)*.
- **`databaseSchema`**: Reference to Database Schema that contains this stored procedure. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`database`**: Reference to Database that contains this stored procedure. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`service`**: Link to Database service this table is hosted in. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`serviceType`**: Service type this table is hosted in. Refer to *[../services/databaseService.json#/definitions/databaseServiceType](#/services/databaseService.json#/definitions/databaseServiceType)*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `false`.
- **`owners`**: Owners of this Stored Procedure. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
- **`followers`**: Followers of this Stored Procedure. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`votes`**: Votes on the entity. Refer to *[../../type/votes.json](#/../type/votes.json)*.
- **`code`**: SQL Query definition. Refer to *[../../type/basic.json#/definitions/sqlQuery](#/../type/basic.json#/definitions/sqlQuery)*.
- **`tags`** *(array)*: Tags for this SQL query. Default: `[]`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *[../../type/basic.json#/definitions/entityExtension](#/../type/basic.json#/definitions/entityExtension)*.
- **`sourceUrl`**: Source URL of database schema. Refer to *[../../type/basic.json#/definitions/sourceUrl](#/../type/basic.json#/definitions/sourceUrl)*.
- **`domain`**: Domain the Stored Procedure belongs to. When not set, the Stored Procedure inherits the domain from the database schemna it belongs to. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`lifeCycle`**: Life Cycle properties of the entity. Refer to *[../../type/lifeCycle.json](#/../type/lifeCycle.json)*.
- **`certification`**: Refer to *[../../type/assetCertification.json](#/../type/assetCertification.json)*.
- **`sourceHash`** *(string)*: Source hash of the entity.
## Definitions

- **`storedProcedureType`** *(string)*: This schema defines the type of the type of Procedures. Must be one of: `["StoredProcedure", "UDF", "StoredPackage"]`. Default: `"StoredProcedure"`.
- **`storedProcedureCode`**
  - **`language`** *(string)*: This schema defines the type of the language used for Stored Procedure's Code. Must be one of: `["SQL", "Java", "JavaScript", "Python", "External"]`.
  - **`code`** *(string)*: This schema defines the type of the language used for Stored Procedure's Code.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
