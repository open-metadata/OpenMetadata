---
title: Create Glossary API | OpenMetadata Glossary API
slug: /main-concepts/metadata-standard/schemas/api/data/createglossary
---

# CreateGlossaryRequest

*Create Glossary entity request*

## Properties

- **`name`**: Name that identifies this glossary. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name that identifies this glossary.
- **`description`**: Description of the glossary instance. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`reviewers`**: User references of the reviewers for this glossary. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*.
- **`owners`**: Owners of this glossary. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
- **`tags`** *(array)*: Tags for this glossary. Default: `null`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`provider`**: Refer to *[../../type/basic.json#/definitions/providerType](#/../type/basic.json#/definitions/providerType)*.
- **`mutuallyExclusive`** *(boolean)*: Glossary terms that are direct children in this glossary are mutually exclusive. When mutually exclusive is `true` only one term can be used to label an entity. When mutually exclusive is `false`, multiple terms from this group can be used to label an entity. Default: `"false"`.
- **`domain`** *(string)*: Fully qualified name of the domain the Glossary belongs to.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *[../../type/basic.json#/definitions/entityExtension](#/../type/basic.json#/definitions/entityExtension)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
