---
title: databaseSchema
slug: /main-concepts/metadata-standard/schemas/entity/data/databaseschema
---

# Database Schema

*This schema defines the Database Schema entity. A database schema is collection of tables, views, stored procedures, and other database objects.*

## Properties

- **`id`**: Unique identifier that identifies this schema instance. Refer to *../../type/basic.json#/definitions/uuid*.
- **`name`**: Name that identifies the schema. Refer to *../../type/basic.json#/definitions/entityName*.
- **`fullyQualifiedName`**: Name that uniquely identifies a schema in the format 'ServiceName.DatabaseName.SchemaName'. Refer to *../../type/basic.json#/definitions/fullyQualifiedEntityName*.
- **`displayName`** *(string)*: Display Name that identifies this schema.
- **`description`**: Description of the schema instance. Refer to *../../type/basic.json#/definitions/markdown*.
- **`version`**: Metadata version of the entity. Refer to *../../type/entityHistory.json#/definitions/entityVersion*.
- **`updatedAt`**: Last update time corresponding to the new version of the entity in Unix epoch time milliseconds. Refer to *../../type/basic.json#/definitions/timestamp*.
- **`updatedBy`** *(string)*: User who made the update.
- **`href`**: Link to the resource corresponding to this entity. Refer to *../../type/basic.json#/definitions/href*.
- **`owner`**: Owner of this schema. Refer to *../../type/entityReference.json*.
- **`service`**: Link to the database cluster/service where this schema is hosted in. Refer to *../../type/entityReference.json*.
- **`serviceType`**: Service type where this schema is hosted in. Refer to *../services/databaseService.json#/definitions/databaseServiceType*.
- **`database`**: Reference to Database that contains this table. Refer to *../../type/entityReference.json*.
- **`tables`**: References to tables in the schema. Refer to *../../type/entityReference.json#/definitions/entityReferenceList*.
- **`usageSummary`**: Latest usage information for this database. Refer to *../../type/usageDetails.json*. Default: `None`.
- **`changeDescription`**: Change that lead to this version of the entity. Refer to *../../type/entityHistory.json#/definitions/changeDescription*.
- **`deleted`** *(boolean)*: When `true` indicates the entity has been soft deleted. Default: `False`.


Documentation file automatically generated at 2022-07-13 15:15:58.612083.
