---
title: spreadsheet
slug: /main-concepts/metadata-standard/schemas/entity/data/spreadsheet
---

# Spreadsheet

*This schema defines the Spreadsheet entity. A Spreadsheet is a file containing multiple worksheets/tabs, such as Google Sheets or Excel files.*

## Properties

- **`id`**: Unique identifier that identifies this spreadsheet instance. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Name that identifies the spreadsheet. Refer to *../../type/basic.json#/definitions/entityName*.
- **`fullyQualifiedName`**: Name that uniquely identifies a spreadsheet in the format 'ServiceName.DirectoryPath.SpreadsheetName'. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Display Name that identifies this spreadsheet.
- **`description`**: Description of the spreadsheet instance. Refer to *../../type/basic.json#/definitions/markdown*.
- **`service`**: Link to the drive service where this spreadsheet is hosted. Refer to *../../type/entityReference.json*.
- **`serviceType`**: Service type where this spreadsheet is hosted. Refer to *../../entity/services/driveService.json#/definitions/driveServiceType*.
- **`directory`**: Reference to Directory that contains this spreadsheet. Refer to *../../type/entityReference.json*.
- **`worksheets`**: References to worksheets/tabs in the spreadsheet. Refer to *../../type/entityReferenceList.json*.
- **`mimeType`**: MIME type of the spreadsheet file. Refer to *#/definitions/spreadsheetMimeType*.
- **`path`** *(string)*: Full path to the spreadsheet file.
- **`driveFileId`** *(string)*: Native file ID in the source system.
- **`size`** *(integer)*: File size in bytes (may be null for cloud-native files like Google Sheets).
- **`fileVersion`** *(string)*: File version information.
- **`createdTime`**: Spreadsheet creation timestamp. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`modifiedTime`**: Last modification timestamp. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`lastModifiedBy`**: User who last modified the spreadsheet. Refer to *../../type/entityReference.json*.
- **`usageSummary`**: Latest usage information for this spreadsheet. Refer to *../../type/usageDetails.json*. Default: `None`.
- **`sourceUrl`**: Link to view/edit this spreadsheet in the source system (e.g., Google Sheets URL, SharePoint URL). Refer to *../../type/basic.json#/definitions/sourceUrl*.
- **`href`**: Link to the resource corresponding to this spreadsheet. Refer to *../../type/basic.json#/definitions/href*.
- **`owners`**: Owners of this spreadsheet. Refer to *../../type/entityReferenceList.json*.
- **`followers`**: Followers of this entity. Refer to *../../type/entityReferenceList.json*.
- **`tags`** *(array)*: Tags associated with this spreadsheet. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`incrementalChangeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
- **`domains`**: Domains the Spreadsheet belongs to. Refer to *../../type/entityReferenceList.json*.
- **`dataProducts`**: List of data products this entity is part of. Refer to *../../type/entityReferenceList.json*.
- **`lifeCycle`**: Life Cycle of the entity. Refer to *../../type/lifeCycle.json*.
- **`sourceHash`** *(string)*: Source hash of the entity.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *../../type/basic.json#/definitions/entityExtension*.
- **`votes`**: Votes on the entity. Refer to *../../type/votes.json*.
- **`certification`**: Refer to *../../type/assetCertification.json*.
## Definitions

- **`spreadsheetMimeType`** *(string)*: MIME type for spreadsheet files. Must be one of: `['application/vnd.google-apps.spreadsheet', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'application/vnd.oasis.opendocument.spreadsheet', 'text/csv', 'text/tab-separated-values', 'Other']`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
