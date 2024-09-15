---
title: createClassification
slug: /main-concepts/metadata-standard/schemas/api/classification/createclassification
---

# CreateClassificationRequest

*Create classification request*

## Properties

- **`name`**: Refer to *../../entity/classification/tag.json#/definitions/tagName*.
- **`displayName`** *(string)*: Display Name that identifies this classification.
- **`description`**: Description of the classification. Refer to *../../type/basic.json#/definitions/markdown*.
- **`provider`**: Refer to *../../type/basic.json#/definitions/providerType*.
- **`mutuallyExclusive`** *(boolean)*: Tags under this classification are mutually exclusive. When mutually exclusive is `true` the tags from this classification are used to **classify** an entity. An entity can only be in one class - example, it can only be either `tier1` or `tier2` and not both. When mutually exclusive is `false`, the tags from this classification are used to **categorize** an entity. An entity can be in multiple categories simultaneously - example a customer can be `newCustomer` and `atRisk` simultaneously. Default: `false`.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
