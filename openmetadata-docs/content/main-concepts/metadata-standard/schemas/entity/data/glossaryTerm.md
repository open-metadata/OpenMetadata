---
title: glossaryTerm
slug: /main-concepts/metadata-standard/schemas/entity/data/glossaryterm
---

# GlossaryTerm

*This schema defines te Glossary term entities.*

## Properties

- **`id`**: Unique identifier of a glossary term instance. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Preferred name for the glossary term. Refer to *#/definitions/name*.
- **`displayName`** *(string)*: Display Name that identifies this glossary.
- **`description`**: Description of the glossary term. Refer to *../../type/basic.json#/definitions/markdown*.
- **`fullyQualifiedName`**: A unique name that identifies a glossary term. It captures name hierarchy of glossary of terms in the form of `glossaryName.parentTerm.childTerm`. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`synonyms`** *(array)*: Alternate names that are synonyms or near-synonyms for the glossary term.
  - **Items**: Refer to *#/definitions/name*.
- **`glossary`**: Glossary that this term belongs to. Refer to *../../type/entityReference.json*.
- **`parent`**: Parent glossary term that this term is child of. When `null` this term is the root term of the glossary. Refer to *../../type/entityReference.json*.
- **`children`**: Other glossary terms that are children of this glossary term. Refer to *../../type/entityReference.json#/definitions/entityReferenceList*.
- **`relatedTerms`**: Other glossary terms that are related to this glossary term. Refer to *../../type/entityReference.json#/definitions/entityReferenceList*.
- **`references`** *(array)*: Link to a reference from an external glossary.
  - **Items**: Refer to *../../entity/data/glossaryTerm.json#/definitions/termReference*.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this entity. Refer to *../../type/basic.json#/definitions/href*.
- **`reviewers`**: User names of the reviewers for this glossary. Refer to *../../type/entityReference.json#/definitions/entityReferenceList*.
- **`usageCount`** *(integer)*: Count of how many times this and it's children glossary terms are used as labels.
- **`tags`** *(array)*: Tags associated with this glossary term. These tags captures relationship of a glossary term with a tag automatically. As an example a glossary term 'User.PhoneNumber' might have an associated tag 'PII.Sensitive'. When 'User.Address' is used to label a column in a table, 'PII.Sensitive' label is also applied automatically due to Associated tag relationship. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`status`**: Status of the glossary term. Refer to *#/definitions/status*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
## Definitions

- **`name`**: Name that identifies a glossary term. Refer to *../../type/basic.json#/definitions/entityName*.
- **`termReference`** *(object)*: Cannot contain additional properties.
  - **`name`** *(string)*: Name that identifies the source of an external glossary term. Example `HealthCare.gov`.
  - **`endpoint`** *(string)*: Name that identifies the source of an external glossary term. Example `HealthCare.gov`.
- **`status`** *(string)*: Must be one of: `['Draft', 'Approved', 'Deprecated']`. Default: `Draft`.


Documentation file automatically generated at 2022-07-13 15:15:58.612083.
