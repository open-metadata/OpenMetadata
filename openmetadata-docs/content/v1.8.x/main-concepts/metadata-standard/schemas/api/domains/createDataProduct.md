---
title: Create Data Product | OpenMetadataData Product API
description: Define a new data product within a domain to encapsulate curated, reusable datasets and their metadata context.
slug: /main-concepts/metadata-standard/schemas/api/domains/createdataproduct
---

# CreateDataProductRequest

*Create DataProduct API request*

## Properties

- **`name`**: A unique name of the DataProduct. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`fullyQualifiedName`**: FullyQualifiedName of the Domain. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`displayName`** *(string)*: Name used for display purposes. Example 'Customer Churn', 'Sentiment Analysis', etc.
- **`description`**: Description of the DataProduct. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`style`**: Refer to *[../../type/basic.json#/definitions/style](#/../type/basic.json#/definitions/style)*.
- **`owners`**: Owners of this DataProduct. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
- **`domain`**: Fully qualified name of the Domain the DataProduct belongs to. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*. Default: `null`.
- **`experts`** *(array)*: List of user/login names of users who are experts in this DataProduct. Default: `null`.
  - **Items** *(string)*
- **`assets`**: Data assets collection that is part of this data product. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *[../../type/basic.json#/definitions/entityExtension](#/../type/basic.json#/definitions/entityExtension)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
