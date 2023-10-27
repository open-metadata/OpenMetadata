---
title: createDatabaseService
slug: /main-concepts/metadata-standard/schemas/api/services/createdatabaseservice
---

# CreateDatabaseServiceRequest

*Create Database service entity request*

## Properties

- **`name`**: Name that identifies the this entity instance uniquely. Refer to *[../../type/basic.json#/definitions/entityName](#/../type/basic.json#/definitions/entityName)*.
- **`displayName`** *(string)*: Display Name that identifies this database service.
- **`description`**: Description of Database entity. Refer to *[../../type/basic.json#/definitions/markdown](#/../type/basic.json#/definitions/markdown)*.
- **`tags`** *(array)*: Tags for this Database Service. Default: `null`.
  - **Items**: Refer to *[../../type/tagLabel.json](#/../type/tagLabel.json)*.
- **`serviceType`**: Refer to *[../../entity/services/databaseService.json#/definitions/databaseServiceType](#/../entity/services/databaseService.json#/definitions/databaseServiceType)*.
- **`connection`**: Refer to *[../../entity/services/databaseService.json#/definitions/databaseConnection](#/../entity/services/databaseService.json#/definitions/databaseConnection)*.
- **`owner`**: Owner of this database service. Refer to *[../../type/entityReference.json](#/../type/entityReference.json)*.
- **`domain`** *(string)*: Fully qualified name of the domain the Database Service belongs to.


Documentation file automatically generated at 2023-10-27 11:39:15.608628.
