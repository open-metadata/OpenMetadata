---
title: createDirectory
slug: /main-concepts/metadata-standard/schemas/api/data/createdirectory
---

# CreateDirectoryRequest

*Create Directory entity request*

## Properties

- **`name`**: Name that identifies this directory. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this directory.
- **`description`**: Description of the directory. Refer to *../../type/basic.json#/definitions/markdown*.
- **`service`**: Link to the drive service fully qualified name where this directory is hosted in. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`parent`**: Link to the parent directory fully qualified name. If not provided, this is a root directory. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`directoryType`**: Type of directory. Refer to *../../entity/data/directory.json#/definitions/directoryType*.
- **`path`** *(string)*: Full path to the directory.
- **`isShared`** *(boolean)*: Whether this directory is shared. Default: `False`.
- **`numberOfFiles`** *(integer)*: Number of files in this directory.
- **`numberOfSubDirectories`** *(integer)*: Number of subdirectories.
- **`totalSize`** *(integer)*: Total size of all files in bytes.
- **`sourceUrl`**: Source URL of directory. Refer to *../../type/basic.json#/definitions/sourceUrl*.
- **`tags`** *(array)*: Tags for this Directory. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`owners`**: Owners of this directory. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`domains`** *(array)*: Fully qualified names of the domains the Directory belongs to. Default: `None`.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`lifeCycle`**: Life Cycle of the entity. Refer to *../../type/lifeCycle.json*.
- **`sourceHash`** *(string)*: Source hash of the entity.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *../../type/basic.json#/definitions/entityExtension*.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
