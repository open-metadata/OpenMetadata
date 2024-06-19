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
- **`owner`**: Owner of this database service. Refer to *../../type/entityReference.json*.
- **`domain`** *(string)*: Fully qualified name of the domain the Database Service belongs to.


Documentation file automatically generated at 2023-10-27 13:55:46.343512.
