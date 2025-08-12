---
title: createMetadataService
slug: /main-concepts/metadata-standard/schemas/api/services/createmetadataservice
---

# CreateMetadataServiceRequest

*Create Metadata Service entity request*

## Properties

- **`name`**: Name that identifies the this entity instance uniquely. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this Metadata service.
- **`description`**: Description of Metadata entity. Refer to *../../type/basic.json#/definitions/markdown*.
- **`serviceType`**: Refer to *../../entity/services/metadataService.json#/definitions/metadataServiceType*.
- **`connection`**: Refer to *../../entity/services/metadataService.json#/definitions/metadataConnection*.
- **`owners`**: Owners of this Metadata service. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`tags`** *(array)*: Tags for this Metadata Service. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`domains`** *(array)*: Fully qualified names of the domains the Metadata Service belongs to.
  - **Items** *(string)*
- **`ingestionRunner`**: The ingestion agent responsible for executing the ingestion pipeline. Refer to *../../type/entityReference.json*.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
