---
title: createGlossaryTerm
slug: /main-concepts/metadata-standard/schemas/api/data/createglossaryterm
---

# CreateGlossaryTermRequest

*Create Glossary term entity request*

## Properties

- **`glossary`**: FullyQualifiedName of the glossary that this term is part of. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`parent`**: Fully qualified name of  the parent glossary term. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`name`**: Preferred name for the glossary term. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this glossary term.
- **`description`**: Description of the glossary term. Refer to *../../type/basic.json#/definitions/markdown*.
- **`style`**: Refer to *../../type/basic.json#/definitions/style*.
- **`synonyms`** *(array)*: Alternate names that are synonyms or near-synonyms for the glossary term.
  - **Items**: Refer to *../../type/basic.json#/definitions/entityName*.
- **`relatedTerms`** *(array)*: Other array of glossary term fully qualified names that are related to this glossary term.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`references`** *(array)*: Link to a reference from an external glossary.
  - **Items**: Refer to *../../entity/data/glossaryTerm.json#/definitions/termReference*.
- **`reviewers`**: User or Team references of the reviewers for this glossary. Refer to *../../type/entityReferenceList.json*.
- **`owners`**: Owners of this glossary term. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`tags`** *(array)*: Tags for this glossary term. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`provider`**: Refer to *../../type/basic.json#/definitions/providerType*.
- **`mutuallyExclusive`** *(boolean)*: Glossary terms that are children of this term are mutually exclusive. When mutually exclusive is `true` only one term can be used to label an entity from this group. When mutually exclusive is `false`, multiple terms from this group can be used to label an entity. Default: `false`.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *../../type/basic.json#/definitions/entityExtension*.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
