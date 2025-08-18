---
title: thoughtSpotConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/dashboard/thoughtspotconnection
---

# ThoughtSpotConnection

*ThoughtSpot Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/thoughtSpotType*. Default: `ThoughtSpot`.
- **`hostPort`** *(string)*: ThoughtSpot instance URL. Example: https://my-company.thoughtspot.cloud.
- **`authentication`**: ThoughtSpot authentication configuration.
- **`apiVersion`** *(string)*: ThoughtSpot API version to use. Must be one of: `['v1', 'v2']`. Default: `v2`.
- **`orgId`** *(string)*: Org ID for multi-tenant ThoughtSpot instances. This is applicable for ThoughtSpot Cloud only. Default: `None`.
- **`supportsMetadataExtraction`**: Supports Metadata Extraction. Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`thoughtSpotType`** *(string)*: ThoughtSpot service type. Must be one of: `['ThoughtSpot']`. Default: `ThoughtSpot`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
