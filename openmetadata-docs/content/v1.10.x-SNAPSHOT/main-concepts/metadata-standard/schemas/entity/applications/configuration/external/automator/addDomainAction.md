---
title: addDomainAction
slug: /main-concepts/metadata-standard/schemas/entity/applications/configuration/external/automator/adddomainaction
---

# AddDomainAction

*Add domains to the selected assets.*

## Properties

- **`type`**: Application Type. Refer to *#/definitions/addDomainActionType*. Default: `AddDomainAction`.
- **`domains`**: Domains to apply. Refer to *../../../../../type/entityReferenceList.json*.
- **`overwriteMetadata`** *(boolean)*: Update the domains even if they are defined in the asset. By default, we will only apply the domains to assets without domains. Default: `False`.
## Definitions

- **`addDomainActionType`** *(string)*: Add Domain Action Type. Must be one of: `['AddDomainAction']`. Default: `AddDomainAction`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
