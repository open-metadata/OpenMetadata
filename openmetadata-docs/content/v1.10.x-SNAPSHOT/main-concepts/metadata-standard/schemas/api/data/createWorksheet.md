---
title: createWorksheet
slug: /main-concepts/metadata-standard/schemas/api/data/createworksheet
---

# CreateWorksheetRequest

*Create Worksheet entity request*

## Properties

- **`name`**: Name that identifies this worksheet. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this worksheet.
- **`description`**: Description of the worksheet. Refer to *../../type/basic.json#/definitions/markdown*.
- **`spreadsheet`**: Link to the parent spreadsheet fully qualified name. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`service`**: Link to the drive service fully qualified name where this worksheet is hosted in. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`worksheetId`** *(string)*: Native worksheet/tab ID.
- **`index`** *(integer)*: Position/index of the worksheet in the spreadsheet.
- **`rowCount`** *(integer)*: Number of rows in the worksheet.
- **`columnCount`** *(integer)*: Number of columns in the worksheet.
- **`columns`** *(array)*: Column definitions if structured data. Default: `[]`.
  - **Items**: Refer to *../../entity/data/table.json#/definitions/column*.
- **`isHidden`** *(boolean)*: Whether the worksheet is hidden. Default: `False`.
- **`sourceUrl`**: Source URL of worksheet. Refer to *../../type/basic.json#/definitions/sourceUrl*.
- **`tags`** *(array)*: Tags for this Worksheet. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`owners`**: Owners of this worksheet. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`domains`** *(array)*: Fully qualified names of the domains the Worksheet belongs to. Default: `None`.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`lifeCycle`**: Life Cycle of the entity. Refer to *../../type/lifeCycle.json*.
- **`sourceHash`** *(string)*: Source hash of the entity.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *../../type/basic.json#/definitions/entityExtension*.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
