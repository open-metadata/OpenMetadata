---
title: createClassification
slug: /main-concepts/metadata-standard/schemas/api/classification/createclassification
---

# CreateClassificationRequest

*Create classification request*

## Properties

- **`name`**: Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this classification.
- **`description`**: Description of the classification. Refer to *../../type/basic.json#/definitions/markdown*.
- **`provider`**: Refer to *../../type/basic.json#/definitions/providerType*.
- **`mutuallyExclusive`** *(boolean)*: Tags under this classification are mutually exclusive. When mutually exclusive is `true` the tags from this classification are used to **classify** an entity. An entity can only be in one class - example, it can only be either `tier1` or `tier2` and not both. When mutually exclusive is `false`, the tags from this classification are used to **categorize** an entity. An entity can be in multiple categories simultaneously - example a customer can be `newCustomer` and `atRisk` simultaneously. Default: `False`.
- **`domains`** *(array)*: Fully qualified names of the domains the Classification belongs to.
  - **Items** *(string)*
- **`owners`**: Owners of this classification term. Refer to *../../type/entityReferenceList.json*. Default: `None`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
