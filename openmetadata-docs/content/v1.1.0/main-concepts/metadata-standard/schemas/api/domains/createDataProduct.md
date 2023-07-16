---
title: createDataProduct
slug: /main-concepts/metadata-standard/schemas/api/domains/createdataproduct
---

# createDataProduct

*Create DataProduct API request*

## Properties

- **`name`**: A unique name of the DataProduct. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`fullyQualifiedName`**: FullyQualifiedName of the Domain. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`displayName`** *(string)*: Name used for display purposes. Example 'Customer Churn', 'Sentiment Analysis', etc.
- **`description`**: Description of the DataProduct. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`owner`**: Owner of this DataProduct. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*. Default: `null`.
- **`domain`**: Fully qualified name of the Domain the DataProduct belongs to. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*. Default: `null`.
- **`experts`** *(array)*: List of of user/login names of users who are experts in this DataProduct. Default: `null`.
  - **Items** *(string)*


Documentation file automatically generated at 2023-07-16 19:59:36.193714.
