# Database

## Database

This schema defines the Database entity. A database also referred to as Database Catalog is a collection of tables.

**$id:**[**https://open-metadata.org/schema/entity/data/database.json**](https://open-metadata.org/schema/entity/data/database.json)

Type: `object`

This schema does not accept additional properties.

### Properties

## <<<<<<< HEAD

* **id**
  * Unique identifier that identifies this database instance.
  * $ref: [../../type/basic.json#/definitions/uuid](../types/basic.md#uuid)
* **name** `required`
  * Name that identifies the database.
  * $ref: [#/definitions/databaseName](database.md#databasename)
* **fullyQualifiedName**
  * Name that uniquely identifies a database in the format 'ServiceName.DatabaseName'.
  * Type: `string`
* **displayName**
  * Display Name that identifies this database.
  * Type: `string`
* **description**
  * Description of the database instance.
  * Type: `string`
* **version**
  * Metadata version of the entity.
  * $ref: [../../type/entityHistory.json#/definitions/entityVersion](../types/entityhistory.md#entityversion)
* **updatedAt**
  * Last update time corresponding to the new version of the entity in Unix epoch time milliseconds.
  * $ref: [../../type/basic.json#/definitions/timestamp](../types/basic.md#timestamp)
* **updatedBy**
  * User who made the update.
  * Type: `string`
* **href**
  * Link to the resource corresponding to this entity.
  * $ref: [../../type/basic.json#/definitions/href](../types/basic.md#href)
* **owner**
  * Owner of this database.
  * $ref: [../../type/entityReference.json](../types/entityreference.md)
* **service** `required`
  * Link to the database cluster/service where this database is hosted in.
  * $ref: [../../type/entityReference.json](../types/entityreference.md)
* **serviceType**
  * Service type where this database is hosted in.
  * $ref: [../services/databaseService.json#/definitions/databaseServiceType](databaseservice.md#databaseservicetype)
* **location**
  * Reference to the Location that contains this database.
  * $ref: [../../type/entityReference.json](../types/entityreference.md)
* **usageSummary**
  * Latest usage information for this database.
  * $ref: [../../type/usageDetails.json](../types/usagedetails.md)
* **tables**
  * References to tables in the database.
  * $ref: [../../type/entityReference.json#/definitions/entityReferenceList](../types/entityreference.md#entityreferencelist)
* **changeDescription**
  * Change that lead to this version of the entity.
  * $ref: [../../type/entityHistory.json#/definitions/changeDescription](../types/entityhistory.md#changedescription)
* **deleted**
  * When `true` indicates the entity has been soft deleted.
  * Type: `boolean`
  * Default: _false_

> > > > > > > a07bc411 (updated json schema and schema docs (#3219))

* **id**
  * Unique identifier that identifies this database instance.
  * $ref: [../../type/basic.json#/definitions/uuid](../types/basic.md#uuid)
* **name** `required`
  * Name that identifies the database.
  * $ref: [#/definitions/databaseName](database.md#databasename)
* **fullyQualifiedName**
  * Name that uniquely identifies a database in the format 'ServiceName.DatabaseName'.
  * Type: `string`
* **displayName**
  * Display Name that identifies this database.
  * Type: `string`
* **description**
  * Description of the database instance.
  * Type: `string`
* **version**
  * Metadata version of the entity.
  * $ref: [../../type/entityHistory.json#/definitions/entityVersion](../types/entityhistory.md#entityversion)
* **updatedAt**
  * Last update time corresponding to the new version of the entity in Unix epoch time milliseconds.
  * $ref: [../../type/basic.json#/definitions/timestamp](../types/basic.md#timestamp)
* **updatedBy**
  * User who made the update.
  * Type: `string`
* **href**
  * Link to the resource corresponding to this entity.
  * $ref: [../../type/basic.json#/definitions/href](../types/basic.md#href)
* **owner**
  * Owner of this database.
  * $ref: [../../type/entityReference.json](../types/entityreference.md)
* **service** `required`
  * Link to the database cluster/service where this database is hosted in.
  * $ref: [../../type/entityReference.json](../types/entityreference.md)
* **serviceType**
  * Service type where this database is hosted in.
  * $ref: [../services/databaseService.json#/definitions/databaseServiceType](https://github.com/open-metadata/OpenMetadata/blob/main/docs/openmetadata-apis/schemas/services/databaseservice.md#databaseservicetype)
* **location**
  * Reference to the Location that contains this database.
  * $ref: [../../type/entityReference.json](../types/entityreference.md)
* **usageSummary**
  * Latest usage information for this database.
  * $ref: [../../type/usageDetails.json](../types/usagedetails.md)
* **tables**
  * References to tables in the database.
  * $ref: [../../type/entityReference.json#/definitions/entityReferenceList](../types/entityreference.md#entityreferencelist)
* **changeDescription**
  * Change that lead to this version of the entity.
  * $ref: [../../type/entityHistory.json#/definitions/changeDescription](../types/entityhistory.md#changedescription)
* **deleted**
  * When `true` indicates the entity has been soft deleted.
  * Type: `boolean`
  * Default: _false_

### Type definitions in this schema

## <<<<<<< HEAD

#### databaseName

* Name that identifies the database.
* Type: `string`
* Length: between 1 and 128

> > > > > > > a07bc411 (updated json schema and schema docs (#3219))

#### databaseName

* Name that identifies the database.
* Type: `string`
* The value must match this pattern: `^[^.]*$`
* Length: between 1 and 128

## <<<<<<< HEAD _This document was updated on: Tuesday, January 25, 2022_

_This document was updated on: Monday, March 7, 2022_

> > > > > > > a07bc411 (updated json schema and schema docs (#3219))
