---
title: createDomain
slug: /main-concepts/metadata-standard/schemas/api/domains/createdomain
---

# createDomain

*Create Domain API request*

## Properties

- **`domainType`**: Domain type. Refer to *../../entity/domains/domain.json#/definitions/domainType*.
- **`name`**: A unique name of the Domain. Refer to *../../type/basic.json#/definitions/entityName*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Name used for display purposes. Example 'Marketing', 'Payments', etc.
- **`description`**: Description of the Domain. Refer to *../../type/basic.json#/definitions/markdown*.
- **`style`**: Refer to *../../type/basic.json#/definitions/style*.
- **`parent`** *(string)*: Fully qualified name of parent domain.
- **`owner`**: Owner of this Domain. Refer to *../../type/entityReference.json*. Default: `None`.
- **`experts`** *(array)*: List of user/login names of users who are experts in this Domain. Default: `None`.
  - **Items** *(string)*


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
