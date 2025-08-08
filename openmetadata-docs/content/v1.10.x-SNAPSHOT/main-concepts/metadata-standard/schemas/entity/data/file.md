---
title: file
slug: /main-concepts/metadata-standard/schemas/entity/data/file
---

# File

*This schema defines the File entity. A File is a document or resource stored in a Drive Service.*

## Properties

- **`id`**: Unique identifier of this file instance. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Name of the file. Refer to *../../type/basic.json#/definitions/entityName*.
- **`fullyQualifiedName`**: Fully qualified name of the file. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Display Name that identifies this file.
- **`description`**: Description of the file. Refer to *../../type/basic.json#/definitions/markdown*.
- **`service`**: Link to the drive service. Refer to *../../type/entityReference.json*.
- **`serviceType`**: Type of drive service. Refer to *../../entity/services/driveService.json#/definitions/driveServiceType*.
- **`directory`**: Parent directory containing this file. Refer to *../../type/entityReference.json*.
- **`fileType`**: Refer to *#/definitions/fileType*.
- **`mimeType`** *(string)*: MIME type of the file.
- **`fileExtension`** *(string)*: File extension.
- **`path`** *(string)*: Full path to the file.
- **`size`** *(integer)*: File size in bytes.
- **`checksum`** *(string)*: File checksum/hash.
- **`webViewLink`** *(string)*: Web link to view the file.
- **`downloadLink`** *(string)*: Direct download link.
- **`isShared`** *(boolean)*: Whether this file is shared. Default: `False`.
- **`fileVersion`** *(string)*: File version information.
- **`createdTime`**: File creation timestamp. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`modifiedTime`**: Last modification timestamp. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`lastModifiedBy`**: User who last modified the file. Refer to *../../type/entityReference.json*.
- **`sourceUrl`**: Link to this file in the source system. Refer to *../../type/basic.json#/definitions/sourceUrl*.
- **`href`**: Link to the resource corresponding to this file. Refer to *../../type/basic.json#/definitions/href*.
- **`owners`**: Owners of this file. Refer to *../../type/entityReferenceList.json*.
- **`followers`**: Followers of this entity. Refer to *../../type/entityReferenceList.json*.
- **`tags`** *(array)*: Tags associated with this file. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`incrementalChangeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.
- **`domains`**: Domains the File belongs to. Refer to *../../type/entityReferenceList.json*.
- **`dataProducts`**: List of data products this entity is part of. Refer to *../../type/entityReferenceList.json*.
- **`lifeCycle`**: Life Cycle of the entity. Refer to *../../type/lifeCycle.json*.
- **`sourceHash`** *(string)*: Source hash of the entity.
- **`extension`**: Entity extension data with custom attributes added to the entity. Refer to *../../type/basic.json#/definitions/entityExtension*.
- **`votes`**: Votes on the entity. Refer to *../../type/votes.json*.
- **`certification`**: Refer to *../../type/assetCertification.json*.
- **`usageSummary`**: Latest usage information for this file. Refer to *../../type/usageDetails.json*. Default: `None`.
## Definitions

- **`fileType`** *(string)*: Type of file based on content. Must be one of: `['Document', 'Spreadsheet', 'Presentation', 'Image', 'Video', 'Audio', 'PDF', 'Archive', 'Code', 'Data', 'CSV', 'Text', 'Other']`.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
