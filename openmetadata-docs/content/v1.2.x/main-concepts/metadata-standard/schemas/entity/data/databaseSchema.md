---
title: databaseSchema
slug: /main-concepts/metadata-standard/schemas/entity/data/databaseschema
---

# Database Schema

*This schema defines the Database Schema entity. A `Database Schema` is collection of tables, views, stored procedures, and other database objects.*

## Properties

- **`id`**: Unique identifier that identifies this schema instance. Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`name`**: Name that identifies the schema. Refer to *[#/definitions/entityName](#definitions/entityName)*.
- **`fullyQualifiedName`**: Name that uniquely identifies a schema in the format 'ServiceName.DatabaseName.SchemaName'. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`displayName`** *(string)*: Display Name that identifies this schema.
- **`description`**: Description of the schema instance. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`version`**: Metadata version of the entity. Refer to *[../../type/entityHistory.json#/definitions/entityVersion](#/../type/entityHistory.json#/definitions/entityVersion)*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this entity. Refer to *[../../type/basic.json#/definitions/href](#/../type/basic.json#/definitions/href)*.
- **`owner`**: Owner of this schema. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`service`**: Link to the database cluster/service where this schema is hosted in. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`serviceType`**: Service type where this schema is hosted in. Refer to *[../services/databaseService.json#/definitions/databaseServiceType](#/services/databaseService.json#/definitions/databaseServiceType)*.
- **`database`**: Reference to Database that contains this table. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`tables`**: References to tables in the schema. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`usageSummary`**: Latest usage information for this database. Refer to *[../../type/usageDetails.json](#/../type/usageDetails.json)*. Default: `null`.
- **`tags`** *(array)*: Tags for this Database Schema Service. Default: `null`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *[../../type/entityHistory.json#/definitions/changeDescription](#/../type/entityHistory.json#/definitions/changeDescription)*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `false`.
- **`retentionPeriod`**: Retention period of the data in the database schema. Period is expressed as duration in ISO 8601 format in UTC. Example - `P23DT23H`. When not set, the retention period is inherited from the parent database, if it exists. Refer to *[../../type/basic.json#/definitions/duration](#/../type/basic.json#/definitions/duration)*.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *[../../type/basic.json#/definitions/entityExtension](#/../type/basic.json#/definitions/entityExtension)*.
- **`sourceUrl`**: Source URL of database schema. Refer to *[../../type/basic.json#/definitions/sourceUrl](#/../type/basic.json#/definitions/sourceUrl)*.
- **`domain`**: Domain the Database Schema belongs to. When not set, the Schema inherits the domain from the database it belongs to. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`votes`**: Refer to *[../../type/votes.json](#/../type/votes.json)*.
- **`lifeCycle`**: Life Cycle properties of the entity. Refer to *[../../type/lifeCycle.json](#/../type/lifeCycle.json)*.
## Definitions

- <a id="definitions/entityName"></a>**`entityName`** *(string)*: Name of a table. Expected to be unique within a database.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
