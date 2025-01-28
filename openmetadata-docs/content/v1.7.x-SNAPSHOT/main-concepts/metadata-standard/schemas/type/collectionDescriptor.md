---
title: collectionDescriptor
slug: /main-concepts/metadata-standard/schemas/type/collectiondescriptor
---

# CollectionDescriptor

*Type used for capturing the details of a collection.*

## Properties

- **`collection`**: Refer to *[#/definitions/collectionInfo](#definitions/collectionInfo)*.
## Definitions

- **`collectionInfo`** *(object)*: Collection Info. Cannot contain additional properties.
  - **`name`** *(string)*: Unique name that identifies a collection.
  - **`documentation`** *(string)*: Description of collection.
  - **`href`** *(string, format: uri)*: URL of the API endpoint where given collections are available.
  - **`images`**: Refer to *[profile.json#/definitions/imageList](#ofile.json#/definitions/imageList)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
