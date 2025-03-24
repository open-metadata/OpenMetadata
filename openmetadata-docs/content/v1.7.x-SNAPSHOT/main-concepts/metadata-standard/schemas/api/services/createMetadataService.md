---
title: createMetadataService
slug: /main-concepts/metadata-standard/schemas/api/services/createmetadataservice
---

# CreateMetadataServiceRequest

*Create Metadata Service entity request*

## Properties

- **`name`**: Name that identifies the this entity instance uniquely. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name that identifies this Metadata service.
- **`description`**: Description of Metadata entity. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`serviceType`**: Refer to *[../../entity/services/metadataService.json#/definitions/metadataServiceType](#/../entity/services/metadataService.json#/definitions/metadataServiceType)*.
- **`connection`**: Refer to *[../../entity/services/metadataService.json#/definitions/metadataConnection](#/../entity/services/metadataService.json#/definitions/metadataConnection)*.
- **`owners`**: Owners of this Metadata service. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
- **`tags`** *(array)*: Tags for this Metadata Service. Default: `null`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`domain`** *(string)*: Fully qualified name of the domain the Table belongs to.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
