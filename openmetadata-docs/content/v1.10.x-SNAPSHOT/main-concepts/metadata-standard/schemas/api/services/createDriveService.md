---
title: createDriveService
slug: /main-concepts/metadata-standard/schemas/api/services/createdriveservice
---

# CreateDriveServiceRequest

*Create Drive Service entity request*

## Properties

- **`name`**: Name that identifies this drive service. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this drive service.
- **`description`**: Description of drive service entity. Refer to *../../type/basic.json#/definitions/markdown*.
- **`serviceType`**: Type of drive service. Refer to *../../entity/services/driveService.json#/definitions/driveServiceType*.
- **`connection`**: Refer to *../../entity/services/driveService.json#/definitions/driveConnection*.
- **`tags`** *(array)*: Tags for this Drive Service. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`owners`**: Owners of this Drive service. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`domains`** *(array)*: Fully qualified names of the domains the Drive Service belongs to. Default: `None`.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.


Documentation file automatically generated at 2025-08-08 15:20:07.536378+00:00.
