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
- **`provider`**: Refer to *../../type/basic.json#/definitions/providerType*.
- **`mutuallyExclusive`** *(boolean)*: Glossary terms that are direct children in this glossary are mutually exclusive. When mutually exclusive is `true` only one term can be used to label an entity. When mutually exclusive is `false`, multiple terms from this group can be used to label an entity. Default: `false`.


Documentation file automatically generated at 2022-11-17 03:44:30.373132.
