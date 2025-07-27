---
title: Create Domain API | OpenMetadata Domain API
slug: /main-concepts/metadata-standard/schemas/api/domains/createdomain
---

# CreateDomainRequest

*Create Domain API request*

## Properties

- **`domainType`**: Domain type. Refer to *[../../entity/domains/domain.json#/definitions/domainType](#/../entity/domains/domain.json#/definitions/domainType)*.
- **`name`**: A unique name of the Domain. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`fullyQualifiedName`**: FullyQualifiedName same as `name`. Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`displayName`** *(string)*: Name used for display purposes. Example 'Marketing', 'Payments', etc.
- **`description`**: Description of the Domain. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`style`**: Refer to *[../../type/basic.json#/definitions/style](#/../type/basic.json#/definitions/style)*.
- **`parent`** *(string)*: Fully qualified name of parent domain.
- **`owners`**: Owners of this Domain. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
- **`experts`** *(array)*: List of user/login names of users who are experts in this Domain. Default: `null`.
  - **Items** *(string)*


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
