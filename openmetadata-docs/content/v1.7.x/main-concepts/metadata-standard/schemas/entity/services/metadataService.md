---
title: Metadata Service | OpenMetadata Metadata Service
description: Represent metadata service entity for platform-level operations and orchestration.
slug: /main-concepts/metadata-standard/schemas/entity/services/metadataservice
---

# Metadata Service

*This schema defines the Metadata Service entity, such as Amundsen, Atlas etc.*

## Properties

- **`id`**: Unique identifier of this database service instance. Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`name`**: Name that identifies this database service. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`displayName`** *(string)*: Display Name that identifies this database service.
- **`serviceType`**: Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres... Refer to *[#/definitions/metadataServiceType](#definitions/metadataServiceType)*.
- **`description`**: Description of a database service instance. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`connection`**: Refer to *[#/definitions/metadataConnection](#definitions/metadataConnection)*.
- **`pipelines`**: References to pipelines deployed for this database service to extract metadata, usage, lineage etc.. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`version`**: Metadata version of the entity. Refer to *[../../type/entityHistory.json#/definitions/entityVersion](#/../type/entityHistory.json#/definitions/entityVersion)*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`updatedBy`** *(string)*: User who made the update.
- **`testConnectionResult`**: Last test connection results for this service. Refer to *[connections/testConnectionResult.json](#nnections/testConnectionResult.json)*.
- **`tags`** *(array)*: Tags for this Metadata Service. Default: `[]`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`owners`**: Owners of this database service. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`href`**: Link to the resource corresponding to this database service. Refer to *[../../type/basic.json#/definitions/href](#/../type/basic.json#/definitions/href)*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *[../../type/entityHistory.json#/definitions/changeDescription](#/../type/entityHistory.json#/definitions/changeDescription)*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `false`.
- **`provider`**: Refer to *[../../type/basic.json#/definitions/providerType](#/../type/basic.json#/definitions/providerType)*.
- **`domain`**: Domain the asset belongs to. When not set, the asset inherits the domain from the parent it belongs to. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
## Definitions

- **`metadataServiceType`** *(string)*: Type of database service such as Amundsen, Atlas... Must be one of: `["Amundsen", "MetadataES", "OpenMetadata", "Atlas", "Alation", "AlationSink"]`.
- **`metadataConnection`** *(object)*: Metadata Service Connection. Cannot contain additional properties.
  - **`config`**
    - **One of**
      - : Refer to *[./connections/metadata/amundsenConnection.json](#connections/metadata/amundsenConnection.json)*.
      - : Refer to *[./connections/metadata/metadataESConnection.json](#connections/metadata/metadataESConnection.json)*.
      - : Refer to *[./connections/metadata/openMetadataConnection.json](#connections/metadata/openMetadataConnection.json)*.
      - : Refer to *[./connections/metadata/atlasConnection.json](#connections/metadata/atlasConnection.json)*.
      - : Refer to *[./connections/metadata/alationConnection.json](#connections/metadata/alationConnection.json)*.
      - : Refer to *[./connections/metadata/alationSinkConnection.json](#connections/metadata/alationSinkConnection.json)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
