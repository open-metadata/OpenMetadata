---
title: glossary
slug: /main-concepts/metadata-standard/schemas/entity/data/glossary
---

# Glossary

*This schema defines the Glossary entity. A Glossary is collection of hierarchical GlossaryTerms.*

## Properties

- **`id`**: Unique identifier of a glossary instance. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Name of the glossary. Refer to *../../type/basic.json#/definitions/entityName*.
- **`fullyQualifiedName`**: FullyQualifiedName same as name. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Display Name that identifies this glossary.
- **`description`**: Description of the glossary. Refer to *../../type/basic.json#/definitions/markdown*.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this entity. Refer to *../../type/basic.json#/definitions/href*.
- **`reviewers`** *(array)*: User references of the reviewers for this glossary.
  - **Items**: Refer to *../../type/entityReference.json*.
- **`owners`**: Owners of this glossary. Refer to *../../type/entityReferenceList.json*.
- **`usageCount`** *(integer)*: Count of how many times terms from this glossary are used.
- **`tags`** *(array)*: Tags for this glossary. Default: `[]`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`termCount`** *(integer)*: Total number of terms in the glossary. This includes all the children in the hierarchy. Minimum: `0`.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`incrementalChangeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
- **`provider`**: Refer to *../../type/basic.json#/definitions/providerType*.
- **`disabled`** *(boolean)*: System glossary can't be deleted. Use this flag to disable them.
- **`mutuallyExclusive`** *(boolean)*: Glossary terms that are direct children in this glossary are mutually exclusive. When mutually exclusive is `true` only one term can be used to label an entity. When mutually exclusive is `false`, multiple terms from this group can be used to label an entity. Default: `false`.
- **`domains`**: Domains the Glossary belongs to. Refer to *../../type/entityReferenceList.json*.
- **`dataProducts`**: List of data products this entity is part of. Refer to *../../type/entityReferenceList.json*.
- **`votes`**: Votes on the entity. Refer to *../../type/votes.json*.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *../../type/basic.json#/definitions/entityExtension*.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
