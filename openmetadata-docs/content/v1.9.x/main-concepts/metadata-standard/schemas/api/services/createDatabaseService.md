---
title: createDatabaseService | Official Documentation
description: Define a database service entity to manage database connections, schemas, and credential configuration.
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
- **`owners`**: Owners of this database service. Refer to *[../../type/entityReferenceList.json](#/../type/entityReferenceList.json)*. Default: `null`.
- **`dataProducts`** *(array)*: List of fully qualified names of data products this entity is part of.
  - **Items**: Refer to *[../../type/basic.json#/definitions/fullyQualifiedEntityName](#/../type/basic.json#/definitions/fullyQualifiedEntityName)*.
- **`domain`** *(string)*: Fully qualified name of the domain the Database Service belongs to.


Documentation file automatically generated at 2025-01-15 09:05:41.923720+00:00.
