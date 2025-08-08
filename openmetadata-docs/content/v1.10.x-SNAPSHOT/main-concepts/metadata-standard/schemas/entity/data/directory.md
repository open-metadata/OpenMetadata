---
title: directory
slug: /main-concepts/metadata-standard/schemas/entity/data/directory
---

# Directory

*This schema defines the Directory entity. A Directory is a folder or organizational unit in a Drive Service that can contain files, worksheets, and other directories.*

## Properties

- **`id`**: Unique identifier of this directory instance. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Name of the directory. Refer to *../../type/basic.json#/definitions/entityName*.
- **`fullyQualifiedName`**: Fully qualified name of the directory. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Display Name that identifies this directory.
- **`description`**: Description of the directory. Refer to *../../type/basic.json#/definitions/markdown*.
- **`service`**: Link to the drive service this directory belongs to. Refer to *../../type/entityReference.json*.
- **`serviceType`**: Type of drive service. Refer to *../../entity/services/driveService.json#/definitions/driveServiceType*.
- **`parent`**: Parent directory reference. Refer to *../../type/entityReference.json*.
- **`children`**: Child directories and files. Refer to *../../type/entityReferenceList.json*.
- **`directoryType`**: Refer to *#/definitions/directoryType*.
- **`path`** *(string)*: Full path to the directory.
- **`isShared`** *(boolean)*: Whether this directory is shared. Default: `False`.
- **`numberOfFiles`** *(integer)*: Number of files in this directory.
- **`numberOfSubDirectories`** *(integer)*: Number of subdirectories.
- **`totalSize`** *(integer)*: Total size of all files in bytes.
- **`sourceUrl`**: Link to this directory in the source system. Refer to *../../type/basic.json#/definitions/sourceUrl*.
- **`href`**: Link to the resource corresponding to this directory. Refer to *../../type/basic.json#/definitions/href*.
- **`owners`**: Owners of this directory. Refer to *../../type/entityReferenceList.json*.
- **`followers`**: Followers of this entity. Refer to *../../type/entityReferenceList.json*.
- **`tags`** *(array)*: Tags associated with this directory. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`incrementalChangeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
- **`domains`**: Domains the Directory belongs to. Refer to *../../type/entityReferenceList.json*.
- **`dataProducts`**: List of data products this entity is part of. Refer to *../../type/entityReferenceList.json*.
- **`lifeCycle`**: Life Cycle of the entity. Refer to *../../type/lifeCycle.json*.
- **`sourceHash`** *(string)*: Source hash of the entity.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *../../type/basic.json#/definitions/entityExtension*.
- **`votes`**: Votes on the entity. Refer to *../../type/votes.json*.
- **`certification`**: Refer to *../../type/assetCertification.json*.
- **`usageSummary`**: Latest usage information for this directory. Refer to *../../type/usageDetails.json*. Default: `None`.
## Definitions

- **`directoryType`** *(string)*: Type of directory. Must be one of: `['Root', 'MyDrive', 'SharedDrive', 'TeamDrive', 'Folder', 'SharePointSite', 'SharePointLibrary']`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
