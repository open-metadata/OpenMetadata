---
title: Database Schema | OpenMetadataDatabase Schema Details
description: Connect Database to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /main-concepts/metadata-standard/schemas/entity/data/database
---

# Database

*This schema defines the Database entity. A database also referred to as Database Catalog is a collection of schemas.*

## Properties

- **`id`**: Unique identifier that identifies this database instance. Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`name`**: Name that identifies the database. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`fullyQualifiedName`**: Name that uniquely identifies a database in the format 'ServiceName.DatabaseName'. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`displayName`** *(string)*: Display Name that identifies this database.
- **`description`**: Description of the database instance. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`dataProducts`**: List of data products this entity is part of. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`tags`** *(array)*: Tags for this Database. Default: `[]`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`version`**: Metadata version of the entity. Refer to *[../../type/entityHistory.json#/definitions/entityVersion](#/../type/entityHistory.json#/definitions/entityVersion)*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this entity. Refer to *[../../type/basic.json#/definitions/href](#/../type/basic.json#/definitions/href)*.
- **`owners`**: Owners of this database. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`service`**: Link to the database cluster/service where this database is hosted in. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`serviceType`**: Service type where this database is hosted in. Refer to *[../services/databaseService.json#/definitions/databaseServiceType](#/services/databaseService.json#/definitions/databaseServiceType)*.
- **`location`**: Reference to the Location that contains this database. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`usageSummary`**: Latest usage information for this database. Refer to *[../../type/usageDetails.json](#/../type/usageDetails.json)*. Default: `null`.
- **`databaseSchemas`**: References to schemas in the database. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *[../../type/entityHistory.json#/definitions/changeDescription](#/../type/entityHistory.json#/definitions/changeDescription)*.
- **`default`** *(boolean)*: Some databases don't support a database/catalog in the hierarchy and use default database. For example, `MySql`. For such databases, set this flag to true to indicate that this is a default database. Default: `false`.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `false`.
- **`retentionPeriod`**: Retention period of the data in the database. Period is expressed as duration in ISO 8601 format in UTC. Example - `P23DT23H`. Refer to *[../../type/basic.json#/definitions/duration](#/../type/basic.json#/definitions/duration)*.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *[../../type/basic.json#/definitions/entityExtension](#/../type/basic.json#/definitions/entityExtension)*.
- **`sourceUrl`**: Source URL of database. Refer to *[../../type/basic.json#/definitions/sourceUrl](#/../type/basic.json#/definitions/sourceUrl)*.
- **`domain`**: Domain the Database belongs to. When not set, the Database inherits the domain from the database service it belongs to. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`votes`**: Votes on the entity. Refer to *[../../type/votes.json](#/../type/votes.json)*.
- **`lifeCycle`**: Life Cycle properties of the entity. Refer to *[../../type/lifeCycle.json](#/../type/lifeCycle.json)*.
- **`certification`**: Refer to *[../../type/assetCertification.json](#/../type/assetCertification.json)*.
- **`sourceHash`** *(string)*: Source hash of the entity.
- **`databaseProfilerConfig`** *(object)*: This schema defines the type for Database profile config.
  - **`profileSample`** *(number)*: Percentage of data or no. of rows we want to execute the profiler and tests on. Default: `null`.
  - **`profileSampleType`**: Refer to *[./table.json#/definitions/profileSampleType](#table.json#/definitions/profileSampleType)*.
  - **`sampleDataCount`** *(integer)*: Number of row of sample data to be generated. Default: `50`.
  - **`samplingMethodType`**: Refer to *[./table.json#/definitions/samplingMethodType](#table.json#/definitions/samplingMethodType)*.
  - **`sampleDataStorageConfig`**: Refer to *[../services/connections/connectionBasicType.json#/definitions/sampleDataStorageConfig](#/services/connections/connectionBasicType.json#/definitions/sampleDataStorageConfig)*.
## Definitions



Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
