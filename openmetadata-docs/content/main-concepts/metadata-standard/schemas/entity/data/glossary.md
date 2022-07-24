---
title: glossary
slug: /main-concepts/metadata-standard/schemas/entity/data/glossary
---

# Glossary

*This schema defines the Glossary entity. A Glossary is collection of hierarchical GlossaryTerms.*

## Properties

- **`id`**: Unique identifier of a glossary instance. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`** *(string)*: Preferred name for the glossary term. Refer to *#/definitions/name*.
- **`fullyQualifiedName`**: FullyQualifiedName same as name. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Display Name that identifies this glossary.
- **`description`**: Description of the glossary. Refer to *../../type/basic.json#/definitions/markdown*.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this entity. Refer to *../../type/basic.json#/definitions/href*.
- **`reviewers`** *(array)*: User references of the reviewers for this glossary.
  - **Items**: Refer to *../../type/entityReference.json*.
- **`owner`**: Owner of this glossary. Refer to *../../type/entityReference.json*.
- **`usageCount`** *(integer)*: Count of how many times terms from this glossary are used.
- **`tags`** *(array)*: Tags for this glossary. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
## Definitions

- **`name`**: Name that identifies a glossary term. Refer to *../../type/basic.json#/definitions/entityName*.


Documentation file automatically generated at 2022-07-14 10:51:34.749986.
