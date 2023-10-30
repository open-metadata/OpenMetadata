---
title: createDataProduct
slug: /main-concepts/metadata-standard/schemas/api/domains/createdataproduct
---

# createDataProduct

*Create DataProduct API request*

## Properties

- **`name`**: A unique name of the DataProduct. Refer to *../../type/basic.json#/definitions/entityName*.
- **`fullyQualifiedName`**: FullyQualifiedName of the Domain. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Name used for display purposes. Example 'Customer Churn', 'Sentiment Analysis', etc.
- **`description`**: Description of the DataProduct. Refer to *../../type/basic.json#/definitions/markdown*.
- **`style`**: Refer to *../../type/basic.json#/definitions/style*.
- **`owner`**: Owner of this DataProduct. Refer to *../../type/entityReference.json*. Default: `None`.
- **`domain`**: Fully qualified name of the Domain the DataProduct belongs to. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*. Default: `None`.
- **`experts`** *(array)*: List of user/login names of users who are experts in this DataProduct. Default: `None`.
  - **Items** *(string)*
- **`assets`**: Data assets collection that is part of this data product. Refer to *../../type/entityReferenceList.json*. Default: `None`.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
