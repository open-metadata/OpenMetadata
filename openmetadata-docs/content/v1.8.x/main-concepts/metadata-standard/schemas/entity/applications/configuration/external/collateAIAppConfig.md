---
title: Collate AI App Config | OpenMetadata AI App Config
slug: /main-concepts/metadata-standard/schemas/entity/applications/configuration/external/collateaiappconfig
---

# CollateAIAppConfig

*Configuration for the CollateAI External Application.*

## Properties

- **`type`**: Application Type. Refer to *[#/definitions/collateAIAppType](#definitions/collateAIAppType)*. Default: `"CollateAI"`.
- **`filter`** *(string)*: Query filter to be passed to ES. E.g., `{"query":{"bool":{"must":[{"bool":{"should":[{"term":{"domain.displayName.keyword":"DG Anim"}}]}}]}}}`. This is the same payload as in the Explore page.
- **`patchIfEmpty`** *(boolean)*: Patch the description if it is empty, instead of raising a suggestion. Default: `false`.
## Definitions

- **`collateAIAppType`** *(string)*: Application type. Must be one of: `["CollateAI"]`. Default: `"CollateAI"`.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
