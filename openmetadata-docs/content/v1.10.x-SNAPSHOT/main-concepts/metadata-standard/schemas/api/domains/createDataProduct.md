---
title: createDataProduct
slug: /main-concepts/metadata-standard/schemas/api/domains/createdataproduct
---

# CreateDataProductRequest

*Create DataProduct API request*

## Properties

- **`name`**: A unique name of the DataProduct. Refer to *../../type/basic.json#/definitions/entityName*.
- **`fullyQualifiedName`**: FullyQualifiedName of the Domain. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Name used for display purposes. Example 'Customer Churn', 'Sentiment Analysis', etc.
- **`description`**: Description of the DataProduct. Refer to *../../type/basic.json#/definitions/markdown*.
- **`style`**: Refer to *../../type/basic.json#/definitions/style*.
- **`owners`**: Owners of this DataProduct. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`domains`** *(array)*: Fully qualified names of the Domains the DataProduct belongs to. Default: `None`.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`experts`** *(array)*: List of user/login names of users who are experts in this DataProduct. Default: `None`.
  - **Items** *(string)*
- **`assets`**: Data assets collection that is part of this data product. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`tags`** *(array)*: Tags for this Data Product. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *../../type/basic.json#/definitions/entityExtension*.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
