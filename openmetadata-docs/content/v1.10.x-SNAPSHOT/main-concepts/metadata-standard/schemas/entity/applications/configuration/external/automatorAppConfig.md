---
title: automatorAppConfig
slug: /main-concepts/metadata-standard/schemas/entity/applications/configuration/external/automatorappconfig
---

# AutomatorAppConfig

*Configuration for the Automator External Application.*

## Properties

- **`type`**: Application Type. Refer to *#/definitions/automatorAppType*. Default: `Automator`.
- **`resources`**: Entities selected to run the automation. Refer to *#/definitions/resource*.
- **`actions`** *(array)*: Action to take on those entities. E.g., propagate description through lineage, auto tagging, etc.
  - **Items**: Refer to *#/definitions/action*.
## Definitions

- **`automatorAppType`** *(string)*: Application type. Must be one of: `['Automator']`. Default: `Automator`.
- **`resource`** *(object)*: Entities selected to run the automation.
  - **`type`** *(array)*: Type of the entity. E.g., 'table', 'chart',...
    - **Items** *(string)*
  - **`queryFilter`** *(string)*: Query filter to be passed to ES. E.g., `{"query":{"bool":{"must":[{"bool":{"should":[{"term":{"domain.displayName.keyword":"DG Anim"}}]}}]}}}`. This is the same payload as in the Explore page.
  - **`filterJsonTree`** *(string)*: Filter JSON tree to be used for rendering the filters in the UI. This comes from Immutable Tree type of react-awesome-query-builder.
- **`action`**: Action to take on those entities. E.g., propagate description through lineage, auto tagging, etc.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
