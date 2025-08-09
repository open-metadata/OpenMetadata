---
title: sharePointConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/drive/sharepointconnection
---

# SharePointConnection

*SharePoint Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/sharePointType*. Default: `SharePoint`.
- **`clientId`** *(string)*: Application (client) ID from Azure Active Directory.
- **`clientSecret`** *(string)*: Application (client) secret from Azure Active Directory.
- **`tenantId`** *(string)*: Directory (tenant) ID from Azure Active Directory.
- **`siteUrl`** *(string)*: SharePoint site URL. Default: `https://yourorg.sharepoint.com/sites/yoursite`.
- **`siteName`** *(string)*: SharePoint site name.
- **`driveId`** *(string)*: SharePoint drive ID. If not provided, default document library will be used.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`sharePointType`** *(string)*: SharePoint service type. Must be one of: `['SharePoint']`. Default: `SharePoint`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
