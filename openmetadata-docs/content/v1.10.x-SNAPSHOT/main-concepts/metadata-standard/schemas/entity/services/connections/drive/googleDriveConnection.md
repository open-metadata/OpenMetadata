---
title: googleDriveConnection
slug: /main-concepts/metadata-standard/schemas/entity/services/connections/drive/googledriveconnection
---

# GoogleDriveConnection

*Google Drive Connection Config*

## Properties

- **`type`**: Service Type. Refer to *#/definitions/googleDriveType*. Default: `GoogleDrive`.
- **`credentials`**: GCP Credentials for Google Drive API. Refer to *../../../../security/credentials/gcpCredentials.json*.
- **`delegatedEmail`** *(string)*: Email to impersonate using domain-wide delegation.
- **`driveId`** *(string)*: Specific shared drive ID to connect to.
- **`includeTeamDrives`** *(boolean)*: Include shared/team drives in metadata extraction. Default: `True`.
- **`includeGoogleSheets`** *(boolean)*: Extract metadata only for Google Sheets files. Default: `False`.
- **`connectionOptions`**: Refer to *../connectionBasicType.json#/definitions/connectionOptions*.
- **`connectionArguments`**: Refer to *../connectionBasicType.json#/definitions/connectionArguments*.
- **`supportsMetadataExtraction`**: Refer to *../connectionBasicType.json#/definitions/supportsMetadataExtraction*.
## Definitions

- **`googleDriveType`** *(string)*: Google Drive service type. Must be one of: `['GoogleDrive']`. Default: `GoogleDrive`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
