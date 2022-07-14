---
title: createGlossary
slug: /main-concepts/metadata-standard/schemas/api/data/createglossary
---

# CreateGlossaryRequest

*Create Glossary entity request*

## Properties

- **`name`**: Name that identifies this glossary. Refer to *../../entity/data/glossary.json#/definitions/name*.
- **`displayName`** *(string)*: Display Name that identifies this glossary.
- **`description`**: Description of the glossary instance. Refer to *../../type/basic.json#/definitions/markdown*.
- **`reviewers`** *(array)*: User references of the reviewers for this glossary.
  - **Items**: Refer to *../../type/entityReference.json*.
- **`owner`**: Owner of this glossary. Refer to *../../type/entityReference.json*.
- **`tags`** *(array)*: Tags for this glossary. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.


Documentation file automatically generated at 2022-07-13 15:15:58.612083.
