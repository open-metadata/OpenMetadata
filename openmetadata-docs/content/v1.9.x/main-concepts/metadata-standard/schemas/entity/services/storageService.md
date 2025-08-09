---
title: Storage Service | OpenMetadata Storage Service
description: Represent storage service configurations for connecting and ingesting bucketed data systems.
slug: /main-concepts/metadata-standard/schemas/entity/services/storageservice
---

# Storage Service

*This schema defines the Storage Service entity, such as S3, GCS or AZURE.*

## Properties

- **`id`**: Unique identifier of this storage service instance. Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`name`**: Name that identifies this storage service. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`displayName`** *(string)*: Display Name that identifies this storage service.
- **`serviceType`**: Type of storage service such as S3, GCS, AZURE... Refer to *[#/definitions/storageServiceType](#definitions/storageServiceType)*.
- **`description`**: Description of a storage service instance. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`connection`**: Refer to *[#/definitions/storageConnection](#definitions/storageConnection)*.
- **`pipelines`**: References to pipelines deployed for this storage service to extract metadata, usage, lineage etc.. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`testConnectionResult`**: Last test connection results for this service. Refer to *[connections/testConnectionResult.json](#nnections/testConnectionResult.json)*.
- **`tags`** *(array)*: Tags for this storage Service. Default: `[]`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`version`**: Metadata version of the entity. Refer to *[../../type/entityHistory.json#/definitions/entityVersion](#/../type/entityHistory.json#/definitions/entityVersion)*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this storage service. Refer to *[../../type/basic.json#/definitions/href](#/../type/basic.json#/definitions/href)*.
- **`owners`**: Owners of this storage service. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *[../../type/entityHistory.json#/definitions/changeDescription](#/../type/entityHistory.json#/definitions/changeDescription)*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `false`.
- **`dataProducts`**: List of data products this entity is part of. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`domain`**: Domain the Storage service belongs to. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
## Definitions

- **`storageServiceType`** *(string)*: Type of storage service such as S3, GFS, AZURE... Must be one of: `["S3", "ADLS", "GCS", "CustomStorage"]`.
- **`storageConnection`** *(object)*: Storage Connection. Cannot contain additional properties.
  - **`config`**
    - **One of**
      - : Refer to *[connections/storage/s3Connection.json](#nnections/storage/s3Connection.json)*.
      - : Refer to *[connections/storage/adlsConnection.json](#nnections/storage/adlsConnection.json)*.
      - : Refer to *[connections/storage/gcsConnection.json](#nnections/storage/gcsConnection.json)*.
      - : Refer to *[connections/storage/customStorageConnection.json](#nnections/storage/customStorageConnection.json)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
