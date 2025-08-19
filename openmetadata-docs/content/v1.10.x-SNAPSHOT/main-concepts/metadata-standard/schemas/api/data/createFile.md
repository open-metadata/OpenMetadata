---
title: createFile
slug: /main-concepts/metadata-standard/schemas/api/data/createfile
---

# CreateFileRequest

*Create File entity request*

## Properties

- **`name`**: Name that identifies this file. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this file.
- **`description`**: Description of the file. Refer to *../../type/basic.json#/definitions/markdown*.
- **`service`**: Link to the drive service fully qualified name where this file is hosted in. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`directory`**: Link to the parent directory fully qualified name. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`fileType`**: Type of file based on content. Refer to *../../entity/data/file.json#/definitions/fileType*.
- **`mimeType`** *(string)*: MIME type of the file.
- **`fileExtension`** *(string)*: File extension.
- **`path`** *(string)*: Full path to the file.
- **`size`** *(integer)*: File size in bytes.
- **`checksum`** *(string)*: File checksum/hash.
- **`webViewLink`** *(string)*: Web link to view the file.
- **`downloadLink`** *(string)*: Direct download link.
- **`isShared`** *(boolean)*: Whether this file is shared. Default: `False`.
- **`fileVersion`** *(string)*: File version information.
- **`sourceUrl`**: Source URL of file. Refer to *../../type/basic.json#/definitions/sourceUrl*.
- **`tags`** *(array)*: Tags for this File. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`owners`**: Owners of this file. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`domains`** *(array)*: Fully qualified names of the domains the File belongs to. Default: `None`.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`lifeCycle`**: Life Cycle of the entity. Refer to *../../type/lifeCycle.json*.
- **`sourceHash`** *(string)*: Source hash of the entity.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *../../type/basic.json#/definitions/entityExtension*.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
