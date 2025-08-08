---
title: worksheet
slug: /main-concepts/metadata-standard/schemas/entity/data/worksheet
---

# Worksheet

*This schema defines the Worksheet entity. A Worksheet is a tab or sheet within a spreadsheet file (Google Sheets, Excel) that contains structured data.*

## Properties

- **`id`**: Unique identifier of this worksheet instance. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Name of the worksheet. Refer to *../../type/basic.json#/definitions/entityName*.
- **`fullyQualifiedName`**: Fully qualified name of the worksheet. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Display Name that identifies this worksheet.
- **`description`**: Description of the worksheet. Refer to *../../type/basic.json#/definitions/markdown*.
- **`spreadsheet`**: Reference to the parent File entity (with fileType=Spreadsheet). Refer to *../../type/entityReference.json*.
- **`service`**: Link to the drive service. Refer to *../../type/entityReference.json*.
- **`serviceType`**: Type of drive service. Refer to *../../entity/services/driveService.json#/definitions/driveServiceType*.
- **`worksheetId`** *(string)*: Native worksheet/tab ID.
- **`index`** *(integer)*: Position/index of the worksheet in the spreadsheet.
- **`rowCount`** *(integer)*: Number of rows in the worksheet.
- **`columnCount`** *(integer)*: Number of columns in the worksheet.
- **`columns`** *(array)*: Column definitions if structured data. Default: `[]`.
  - **Items**: Refer to *../data/table.json#/definitions/column*.
- **`sampleData`**: Sample data from the worksheet. Refer to *../data/table.json#/definitions/tableData*.
- **`isHidden`** *(boolean)*: Whether the worksheet is hidden. Default: `False`.
- **`sourceUrl`**: Link to this worksheet in the source system. Refer to *../../type/basic.json#/definitions/sourceUrl*.
- **`href`**: Link to the resource corresponding to this worksheet. Refer to *../../type/basic.json#/definitions/href*.
- **`owners`**: Owners of this worksheet. Refer to *../../type/entityReferenceList.json*.
- **`followers`**: Followers of this entity. Refer to *../../type/entityReferenceList.json*.
- **`tags`** *(array)*: Tags associated with this worksheet. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`incrementalChangeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
- **`domains`**: Domains the Worksheet belongs to. Refer to *../../type/entityReferenceList.json*.
- **`dataProducts`**: List of data products this entity is part of. Refer to *../../type/entityReferenceList.json*.
- **`lifeCycle`**: Life Cycle of the entity. Refer to *../../type/lifeCycle.json*.
- **`sourceHash`** *(string)*: Source hash of the entity.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *../../type/basic.json#/definitions/entityExtension*.
- **`votes`**: Votes on the entity. Refer to *../../type/votes.json*.
- **`certification`**: Refer to *../../type/assetCertification.json*.
- **`usageSummary`**: Latest usage information for this worksheet. Refer to *../../type/usageDetails.json*. Default: `None`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
