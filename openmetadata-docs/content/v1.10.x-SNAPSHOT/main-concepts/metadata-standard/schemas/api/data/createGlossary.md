---
title: createGlossary
slug: /main-concepts/metadata-standard/schemas/api/data/createglossary
---

# CreateGlossaryRequest

*Create Glossary entity request*

## Properties

- **`name`**: Name that identifies this glossary. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this glossary.
- **`description`**: Description of the glossary instance. Refer to *../../type/basic.json#/definitions/markdown*.
- **`reviewers`**: User references of the reviewers for this glossary. Refer to *../../type/entityReferenceList.json*.
- **`owners`**: Owners of this glossary. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`tags`** *(array)*: Tags for this glossary. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`provider`**: Refer to *../../type/basic.json#/definitions/providerType*.
- **`mutuallyExclusive`** *(boolean)*: Glossary terms that are direct children in this glossary are mutually exclusive. When mutually exclusive is `true` only one term can be used to label an entity. When mutually exclusive is `false`, multiple terms from this group can be used to label an entity. Default: `false`.
- **`domains`** *(array)*: Fully qualified names of the domains the Glossary belongs to.
  - **Items** *(string)*
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *../../type/basic.json#/definitions/entityExtension*.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
