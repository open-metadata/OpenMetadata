---
title: Container Schema | OpenMetadata Container
slug: /main-concepts/metadata-standard/schemas/entity/data/container
---

# Container

*This schema defines the Container entity. A Container is an abstraction for any path(including the top level eg. bucket in S3) storing data in an Object store such as S3, GCP, Azure. It maps a tree-like structure, where each Container can have a parent and a list of sub-folders, and it can be structured - where it contains structured data, or unstructured where no schema for its data is defined.*

## Properties

- **`id`**: Unique identifier that identifies this container instance. Refer to *[../../type/basic.json#/definitions/uuid](#/../type/basic.json#/definitions/uuid)*.
- **`name`**: Name that identifies the container. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`fullyQualifiedName`**: Name that uniquely identifies a container in the format 'ServiceName.ContainerName'. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`displayName`** *(string)*: Display Name that identifies this container.
- **`description`**: Description of the container instance. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`version`**: Metadata version of the entity. Refer to *[../../type/entityHistory.json#/definitions/entityVersion](#/../type/entityHistory.json#/definitions/entityVersion)*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *[../../type/basic.json#/definitions/timestamp](#/../type/basic.json#/definitions/timestamp)*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this entity. Refer to *[../../type/basic.json#/definitions/href](#/../type/basic.json#/definitions/href)*.
- **`owners`**: Owners of this container. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`service`**: Link to the storage service where this container is hosted in. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`parent`**: Link to the parent container under which this entity sits, if not top level. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`children`**: References to child containers residing under this entity. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`dataModel`**: References to the container's data model, if data is structured, or null otherwise. Refer to *[#/definitions/containerDataModel](#definitions/containerDataModel)*. Default: `null`.
- **`prefix`** *(string)*: Optional prefix path defined for this container. Default: `null`.
- **`numberOfObjects`** *(number)*: The number of objects/files this container has. Default: `null`.
- **`size`** *(number)*: The total size in KB this container has. Default: `null`.
- **`fileFormats`** *(array)*: File & data formats identified for the container:  e.g. dataFormats=[csv, json]. These can be present both when the container has a dataModel or not. Default: `null`.
  - **Items**: Refer to *[#/definitions/fileFormat](#definitions/fileFormat)*.
- **`serviceType`**: Service type this table is hosted in. Refer to *[../services/storageService.json#/definitions/storageServiceType](#/services/storageService.json#/definitions/storageServiceType)*.
- **`followers`**: Followers of this container. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`tags`** *(array)*: Tags for this container. Default: `[]`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *[../../type/entityHistory.json#/definitions/changeDescription](#/../type/entityHistory.json#/definitions/changeDescription)*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `false`.
- **`retentionPeriod`**: Retention period of the data in the Container. Period is expressed as duration in ISO 8601 format in UTC. Example - `P23DT23H`. Refer to *[../../type/basic.json#/definitions/duration](#/../type/basic.json#/definitions/duration)*.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *[../../type/basic.json#/definitions/entityExtension](#/../type/basic.json#/definitions/entityExtension)*.
- **`sourceUrl`**: Source URL of container. Refer to *[../../type/basic.json#/definitions/sourceUrl](#/../type/basic.json#/definitions/sourceUrl)*.
- **`fullPath`** *(string)*: Full path of the container/file.
- **`domain`**: Domain the Container belongs to. When not set, the Container inherits the domain from the storage service it belongs to. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`dataProducts`**: List of data products this entity is part of. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`votes`**: Votes on the entity. Refer to *[../../type/votes.json](#/../type/votes.json)*.
- **`lifeCycle`**: Life Cycle properties of the entity. Refer to *[../../type/lifeCycle.json](#/../type/lifeCycle.json)*.
- **`certification`**: Refer to *[../../type/assetCertification.json](#/../type/assetCertification.json)*.
- **`sourceHash`** *(string)*: Source hash of the entity.
## Definitions

- **`containerDataModel`** *(object)*: This captures information about how the container's data is modeled, if it has a schema. . Cannot contain additional properties.
  - **`isPartitioned`** *(boolean)*: Whether the data under this container is partitioned by some property, eg. eventTime=yyyy-mm-dd. Default: `false`.
  - **`columns`** *(array, required)*: Columns belonging to this container's schema.
    - **Items**: Refer to *[../data/table.json#/definitions/column](#/data/table.json#/definitions/column)*.
- **`fileFormat`** *(string)*: This schema defines the file formats for the object/files within a container. Must be one of: `["zip", "gz", "zstd", "csv", "tsv", "json", "parquet", "avro"]`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
