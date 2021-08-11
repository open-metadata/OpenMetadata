# Database

This schema defines the Database entity. A database is a collection of schemas. They are also referred to as Database Catalog.

**$id:** [**https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/database.json**](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/database.json)

Type: `object`

## Properties

* **id**
  * Unique identifier that identifies this database instance.
  * $ref: [../../type/basic.json\#/definitions/uuid](database.md#....typebasic.jsondefinitionsuuid)
* **name** `required`
  * Name that identifies the database.
  * $ref: [\#/definitions/databaseName](database.md#/definitions/databaseName)
* **fullyQualifiedName**
  * Name that uniquely identifies a database in the format 'ServiceName.DatabaseName'.
  * Type: `string`
* **description**
  * Description of the database instance.
  * Type: `string`
* **href**
  * Link to the resource corresponding to this entity.
  * $ref: [../../type/basic.json\#/definitions/href](database.md#....typebasic.jsondefinitionshref)
* **owner**
  * Owner of this database.
  * $ref: [../../type/entityReference.json](database.md#....typeentityreference.json)
* **service** `required`
  * Link to the database cluster/service where this database is hosted in.
  * $ref: [../../type/entityReference.json](database.md#....typeentityreference.json)
* **usageSummary**
  * Latest usage information for this database.
  * $ref: [../../type/usageDetails.json](database.md#....typeusagedetails.json)
* **tables**
  * References to tables in the database.
  * $ref: [../../type/entityReference.json\#/definitions/entityReferenceList](database.md#....typeentityreference.jsondefinitionsentityreferencelist)

## Types defined in this schema

**databaseName**

* Name that identifies the database.
* Type: `string`
* The value must match this pattern: `^[^.]*$`
* Length: between 1 and 64

