---
title: collateAITierAgentAppConfig
slug: /main-concepts/metadata-standard/schemas/entity/applications/configuration/internal/collateaitieragentappconfig
---

# CollateAITierAgentAppConfig.json

*Configuration for the Collate AI Quality Agent.*

## Properties

- **`type`**: Application Type. Refer to *#/definitions/collateAITierAgentAppType*. Default: `CollateAITierAgent`.
- **`filter`** *(string)*: Query filter to be passed to ES. E.g., `{"query":{"bool":{"must":[{"bool":{"should":[{"term":{"domain.displayName.keyword":"DG Anim"}}]}}]}}}`. This is the same payload as in the Explore page.
- **`patchIfEmpty`** *(boolean)*: Patch the tier if it is empty, instead of raising a suggestion. Default: `False`.
## Definitions

- **`collateAITierAgentAppType`** *(string)*: Application type. Must be one of: `['CollateAITierAgent']`. Default: `CollateAITierAgent`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
