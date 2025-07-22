---
title: addGlossaryToAssetsRequest | Official Documentation
description: Connect Addglossarytoassetsrequest to enable streamlined access, monitoring, or search of enterprise data using secure and scalable integrations.
slug: /main-concepts/metadata-standard/schemas/api/addglossarytoassetsrequest
---

# AddGlossaryToAssetsRequest

*Create Request for adding a glossary to assets*

## Properties

- **`operation`** *(string)*: Operation to be performed. Must be one of: `["AddAssets", "AddGlossaryTags"]`.
- **`dryRun`** *(boolean)*: If true, the request will be validated but no changes will be made. Default: `true`.
- **`glossaryTags`** *(array)*: Glossary Tags to be added. Default: `null`.
  - **Items**: Refer to *[../type/tagLabel.json](#/type/tagLabel.json)*.
- **`assets`**: List of assets to be created against which the glossary needs to be added. Refer to *[../type/entityReferenceList.json](#/type/entityReferenceList.json)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
