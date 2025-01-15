---
title: addTagToAssetsRequest
slug: /main-concepts/metadata-standard/schemas/api/addtagtoassetsrequest
---

# AddTagToAssetsRequest

*Create Request for adding a tag to assets*

## Properties

- **`operation`** *(string)*: Operation to be performed. Must be one of: `["AddAssets", "AddClassificationTags"]`.
- **`dryRun`** *(boolean)*: If true, the request will be validated but no changes will be made. Default: `true`.
- **`assets`**: List of assets to be created against which the tag needs to be added. Refer to *[../type/entityReferenceList.json](#/type/entityReferenceList.json)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
