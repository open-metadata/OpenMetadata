---
title: lineagePropagationAction
slug: /main-concepts/metadata-standard/schemas/entity/applications/configuration/external/automator/lineagepropagationaction
---

# LineagePropagationAction

*Propagate description, tags and glossary terms via lineage*

## Properties

- **`type`**: Application Type. Refer to *#/definitions/lineagePropagationActionType*. Default: `LineagePropagationAction`.
- **`propagateDescription`** *(boolean)*: Propagate description through lineage. Default: `True`.
- **`propagateTags`** *(boolean)*: Propagate tags through lineage. Default: `True`.
- **`propagateGlossaryTerms`** *(boolean)*: Propagate glossary terms through lineage. Default: `True`.
- **`propagateTier`** *(boolean)*: Propagate tier from the parent. Default: `False`.
- **`propagateDomains`** *(boolean)*: Propagate domains from the parent through lineage. Default: `False`.
- **`propagateOwner`** *(boolean)*: Propagate owner from the parent. Default: `False`.
- **`propagateColumnLevel`** *(boolean)*: Propagate the metadata to columns via column-level lineage. Default: `True`.
- **`propagateParent`** *(boolean)*: Propagate the metadata to the parents (e.g., tables) via lineage. Default: `False`.
- **`overwriteMetadata`** *(boolean)*: Update descriptions, tags and Glossary Terms via lineage even if they are already defined in the asset. By default, descriptions are only updated if they are not already defined in the asset, and incoming tags are merged with the existing ones. Default: `False`.
- **`propagationDepth`** *(integer)*: Number of levels to propagate lineage. If not set, it will propagate to all levels. Default: `None`.
- **`propagationStopConfigs`** *(array)*: List of configurations to stop propagation based on conditions. Default: `None`.
  - **Items**: Refer to *propagationStopConfig.json*.
## Definitions

- **`lineagePropagationActionType`** *(string)*: Lineage propagation action type. Must be one of: `['LineagePropagationAction']`. Default: `LineagePropagationAction`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
