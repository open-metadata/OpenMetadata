---
title: createGlossaryTerm
slug: /main-concepts/metadata-standard/schemas/api/data/createglossaryterm
---

# CreateGlossaryTermRequest

*Create Glossary term entity request*

## Properties

- **`glossary`**: Reference to the glossary that this term is part of. Refer to *../../type/entityReference.json*.
- **`parent`**: Reference to the parent glossary term. When null, the term is at the root of the glossary. Refer to *../../type/entityReference.json*.
- **`name`**: Preferred name for the glossary term. Refer to *../../entity/data/glossaryTerm.json#/definitions/name*.
- **`displayName`** *(string)*: Display Name that identifies this glossary term.
- **`description`**: Description of the glossary term. Refer to *../../type/basic.json#/definitions/markdown*.
- **`synonyms`** *(array)*: Alternate names that are synonyms or near-synonyms for the glossary term.
  - **Items**: Refer to *../../entity/data/glossaryTerm.json#/definitions/name*.
- **`relatedTerms`**: Other glossary terms that are related to this glossary term. Refer to *../../type/entityReference.json#/definitions/entityReferenceList*.
- **`references`** *(array)*: Link to a reference from an external glossary.
  - **Items**: Refer to *../../entity/data/glossaryTerm.json#/definitions/termReference*.
- **`reviewers`**: User names of the reviewers for this glossary. Refer to *../../type/entityReference.json#/definitions/entityReferenceList*.
- **`tags`** *(array)*: Tags for this glossary term. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.


Documentation file automatically generated at 2022-07-13 15:15:58.612083.
