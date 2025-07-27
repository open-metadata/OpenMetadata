---
title: Create Container API | OpenMetadata Container API
description: Create a container entity to logically group storage or table-related assets such as files, objects, or datasets.
slug: /main-concepts/metadata-standard/schemas/api/data/createcontainer
---

# CreateContainerRequest

*Create Container Model entity request*

## Properties

- **`name`**: Name that identifies this Container model. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name that identifies this Container model.
- **`description`**: Description of the Container instance. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`service`**: Link to the storage service where this container is hosted in. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`parent`**: Link to the parent container under which this entity sits. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`dataModel`**: References to the container's data model, if data is structured, or null otherwise. Refer to *[../../entity/data/container.json#/definitions/containerDataModel](#/../entity/data/container.json#/definitions/containerDataModel)*. Default: `null`.
- **`prefix`** *(string)*: Optional prefix path defined for this container. Default: `null`.
- **`numberOfObjects`** *(number)*: The number of objects/files this container has. Default: `null`.
- **`size`** *(number)*: The total size in KB this container has. Default: `null`.
- **`fileFormats`** *(array)*: File & data formats identified for the container:  e.g. dataFormats=[csv, json]. These can be present both when the container has a dataModel or not. Default: `null`.
  - **Items**: Refer to *[../../entity/data/container.json#/definitions/fileFormat](#/../entity/data/container.json#/definitions/fileFormat)*.
- **`owners`**: Owner of this database. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
- **`tags`** *(array)*: Tags for this Container Model. Default: `null`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *[../../type/basic.json#/definitions/entityExtension](#/../type/basic.json#/definitions/entityExtension)*.
- **`sourceUrl`**: Source URL of container. Refer to *[../../type/basic.json#/definitions/sourceUrl](#/../type/basic.json#/definitions/sourceUrl)*.
- **`fullPath`** *(string)*: Full path of the container/file.
- **`domain`** *(string)*: Fully qualified name of the domain the Container belongs to.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`lifeCycle`**: Life Cycle of the entity. Refer to *[../../type/lifeCycle.json](#/../type/lifeCycle.json)*.
- **`sourceHash`** *(string)*: Source hash of the entity.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
