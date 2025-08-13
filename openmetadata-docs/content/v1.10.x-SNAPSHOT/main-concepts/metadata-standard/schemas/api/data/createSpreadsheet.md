---
title: createSpreadsheet
slug: /main-concepts/metadata-standard/schemas/api/data/createspreadsheet
---

# CreateSpreadsheetRequest

*Create Spreadsheet entity request*

## Properties

- **`name`**: Name that identifies this spreadsheet. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this spreadsheet.
- **`description`**: Description of the spreadsheet. Refer to *../../type/basic.json#/definitions/markdown*.
- **`service`**: Link to the drive service fully qualified name where this spreadsheet is hosted in. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`parent`**: Reference to the parent entity (directory). If not provided, the spreadsheet will be created directly under the service. Refer to *../../type/entityReference.json*.
- **`mimeType`**: MIME type of the spreadsheet file. Refer to *../../entity/data/spreadsheet.json#/definitions/spreadsheetMimeType*.
- **`path`** *(string)*: Full path to the spreadsheet file.
- **`driveFileId`** *(string)*: Native file ID in the source system.
- **`size`** *(integer)*: File size in bytes (may be null for cloud-native files like Google Sheets).
- **`fileVersion`** *(string)*: File version information.
- **`sourceUrl`**: Link to view/edit this spreadsheet in the source system (e.g., Google Sheets URL, SharePoint URL). Refer to *../../type/basic.json#/definitions/sourceUrl*.
- **`tags`** *(array)*: Tags for this Spreadsheet. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`owners`**: Owners of this spreadsheet. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`domains`** *(array)*: Fully qualified names of the domains the Spreadsheet belongs to. Default: `None`.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`lifeCycle`**: Life Cycle of the entity. Refer to *../../type/lifeCycle.json*.
- **`sourceHash`** *(string)*: Source hash of the entity.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *../../type/basic.json#/definitions/entityExtension*.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
