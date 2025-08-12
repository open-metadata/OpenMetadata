---
title: Automator App Config | OpenMetadata Automator Config
description: Configure Automator app using this schema to define automation rules, triggers, and data operations.
slug: /main-concepts/metadata-standard/schemas/entity/applications/configuration/external/automatorappconfig
---

# AutomatorAppConfig

*Configuration for the Automator External Application.*

## Properties

- **`type`**: Application Type. Refer to *[#/definitions/automatorAppType](#definitions/automatorAppType)*. Default: `"Automator"`.
- **`resources`**: Entities selected to run the automation. Refer to *[#/definitions/resource](#definitions/resource)*.
- **`actions`** *(array)*: Action to take on those entities. E.g., propagate description through lineage, auto tagging, etc.
  - **Items**: Refer to *[#/definitions/action](#definitions/action)*.
## Definitions

- **`automatorAppType`** *(string)*: Application type. Must be one of: `["Automator"]`. Default: `"Automator"`.
- **`resource`** *(object)*: Entities selected to run the automation.
  - **`type`** *(array)*: Type of the entity. E.g., 'table', 'chart',...
    - **Items** *(string)*
  - **`queryFilter`** *(string)*: Query filter to be passed to ES. E.g., `{"query":{"bool":{"must":[{"bool":{"should":[{"term":{"domain.displayName.keyword":"DG Anim"}}]}}]}}}`. This is the same payload as in the Explore page.
- **`action`**: Action to take on those entities. E.g., propagate description through lineage, auto tagging, etc.
  - **One of**
    - : Refer to *[automator/addTagsAction.json](#tomator/addTagsAction.json)*.
    - : Refer to *[automator/removeTagsAction.json](#tomator/removeTagsAction.json)*.
    - : Refer to *[automator/addDomainAction.json](#tomator/addDomainAction.json)*.
    - : Refer to *[automator/removeDomainAction.json](#tomator/removeDomainAction.json)*.
    - : Refer to *[automator/addDescriptionAction.json](#tomator/addDescriptionAction.json)*.
    - : Refer to *[automator/addCustomProperties.json](#tomator/addCustomProperties.json)*.
    - : Refer to *[automator/removeDescriptionAction.json](#tomator/removeDescriptionAction.json)*.
    - : Refer to *[automator/addTierAction.json](#tomator/addTierAction.json)*.
    - : Refer to *[automator/removeTierAction.json](#tomator/removeTierAction.json)*.
    - : Refer to *[automator/addOwnerAction.json](#tomator/addOwnerAction.json)*.
    - : Refer to *[automator/removeOwnerAction.json](#tomator/removeOwnerAction.json)*.
    - : Refer to *[automator/removeCustomPropertiesAction.json](#tomator/removeCustomPropertiesAction.json)*.
    - : Refer to *[automator/lineagePropagationAction.json](#tomator/lineagePropagationAction.json)*.
    - : Refer to *[automator/mlTaggingAction.json](#tomator/mlTaggingAction.json)*.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
