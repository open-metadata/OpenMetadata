---
title: createDatabaseService
slug: /main-concepts/metadata-standard/schemas/api/services/createdatabaseservice
---

# CreateDatabaseServiceRequest

*Create Database service entity request*

## Properties

- **`name`**: Name that identifies the this entity instance uniquely. Refer to *../../type/basic.json#/definitions/entityName*.
- **`displayName`** *(string)*: Display Name that identifies this database service.
- **`description`**: Description of Database entity. Refer to *../../type/basic.json#/definitions/markdown*.
- **`tags`** *(array)*: Tags for this Database Service. Default: `None`.
  - **Items**: Refer to *../../type/tagLabel.json*.
- **`serviceType`**: Refer to *../../entity/services/databaseService.json#/definitions/databaseServiceType*.
- **`connection`**: Refer to *../../entity/services/databaseService.json#/definitions/databaseConnection*.
- **`owners`**: Owners of this database service. Refer to *../../type/entityReferenceList.json*. Default: `None`.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`domains`** *(array)*: Fully qualified names of the domains the Database Service belongs to.
  - **Items** *(string)*
- **`ingestionRunner`**: The ingestion agent responsible for executing the ingestion pipeline. It will be defined at runtime based on the Ingestion Agent of the service. Refer to *../../type/entityReference.json*.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
