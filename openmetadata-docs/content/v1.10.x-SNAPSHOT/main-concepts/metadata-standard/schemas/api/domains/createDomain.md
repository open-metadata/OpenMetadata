---
title: createDomain
slug: /main-concepts/metadata-standard/schemas/api/domains/createdomain
---

# CreateDomainRequest

*Create Domain API request*

## Properties

- **`domainType`**: Domain type. Refer to *../../entity/domains/domain.json#/definitions/domainType*.
- **`name`**: A unique name of the Domain. Refer to *../../type/basic.json#/definitions/entityName*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Name used for display purposes. Example 'Marketing', 'Payments', etc.
- **`description`**: Description of the Domain. Refer to *../../type/basic.json#/definitions/markdown*.
- **`style`**: Refer to *../../type/basic.json#/definitions/style*.
- **`parent`** *(string)*: Fully qualified name of parent domain.
- **`owners`**: Owners of this Domain. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`experts`** *(array)*: List of user/login names of users who are experts in this Domain. Default: `None`.
  - **Items** *(string)*
- **`tags`** *(array)*: Tags for this Domain. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *../../type/basic.json#/definitions/entityExtension*.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
