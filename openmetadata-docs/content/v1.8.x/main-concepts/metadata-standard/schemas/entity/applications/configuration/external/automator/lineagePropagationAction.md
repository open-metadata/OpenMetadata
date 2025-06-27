---
title: lineagePropagationAction
slug: /main-concepts/metadata-standard/schemas/entity/applications/configuration/external/automator/lineagepropagationaction
---

# LineagePropagationAction

*Propagate description, tags and glossary terms via lineage*

## Properties

- **`type`**: Application Type. Refer to *[#/definitions/lineagePropagationActionType](#definitions/lineagePropagationActionType)*. Default: `"LineagePropagationAction"`.
- **`propagateDescription`** *(boolean)*: Propagate description through lineage. Default: `true`.
- **`propagateTags`** *(boolean)*: Propagate tags through lineage. Default: `true`.
- **`propagateGlossaryTerms`** *(boolean)*: Propagate glossary terms through lineage. Default: `true`.
- **`propagateTier`** *(boolean)*: Propagate tier from the parent. Default: `false`.
- **`propagateOwner`** *(boolean)*: Propagate owner from the parent. Default: `false`.
- **`propagateColumnLevel`** *(boolean)*: Propagate the metadata to columns via column-level lineage. Default: `true`.
- **`propagateParent`** *(boolean)*: Propagate the metadata to the parents (e.g., tables) via lineage. Default: `false`.
- **`overwriteMetadata`** *(boolean)*: Update descriptions, tags and Glossary Terms via lineage even if they are already defined in the asset. By default, descriptions are only updated if they are not already defined in the asset, and incoming tags are merged with the existing ones. Default: `false`.
## Definitions

- **`lineagePropagationActionType`** *(string)*: Lineage propagation action type. Must be one of: `["LineagePropagationAction"]`. Default: `"LineagePropagationAction"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
