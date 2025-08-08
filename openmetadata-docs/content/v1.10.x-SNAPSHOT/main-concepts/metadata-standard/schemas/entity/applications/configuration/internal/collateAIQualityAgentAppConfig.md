---
title: collateAIQualityAgentAppConfig
slug: /main-concepts/metadata-standard/schemas/entity/applications/configuration/internal/collateaiqualityagentappconfig
---

# CollateAIQualityAgentAppConfig.json

*Configuration for the Collate AI Quality Agent.*

## Properties

- **`type`**: Application Type. Refer to *#/definitions/collateAIQualityAgentAppType*. Default: `CollateAIQualityAgent`.
- **`filter`** *(string)*: Query filter to be passed to ES. E.g., `{"query":{"bool":{"must":[{"bool":{"should":[{"term":{"domain.displayName.keyword":"DG Anim"}}]}}]}}}`. This is the same payload as in the Explore page.
- **`active`** *(boolean)*: Whether the suggested tests should be active or not upon suggestion. Default: `False`.
## Definitions

- **`collateAIQualityAgentAppType`** *(string)*: Application type. Must be one of: `['CollateAIQualityAgent']`. Default: `CollateAIQualityAgent`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
