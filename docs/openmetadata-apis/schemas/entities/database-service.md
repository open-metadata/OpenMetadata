# Database Service

This schema defines the Database Service entity, such as MySQL, BigQuery, Redshift, Postgres, or Snowflake. Alternative terms such as Database Cluster, Database Server instance are also used.

**$id:** [**https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json**](https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json)

Type: `object`

## Properties

* **id** `required`
  * Unique identifier of this database service instance.
  * $ref: [../../type/basic.json\#/definitions/uuid](database-service.md#....typebasic.jsondefinitionsuuid)
* **name** `required`
  * Name that identifies this database service.
  * Type: `string`
  * Length: between 1 and 64
* **serviceType** `required`
  * Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres...
  * $ref: [\#/definitions/databaseServiceType](database-service.md#/definitions/databaseServiceType)
* **description**
  * Description of a database service instance.
  * Type: `string`
* **href** `required`
  * Link to the resource corresponding to this database service.
  * $ref: [../../type/basic.json\#/definitions/href](database-service.md#....typebasic.jsondefinitionshref)
* **jdbc** `required`
  * JDBC connection information
  * $ref: [../../type/jdbcConnection.json\#/definitions/jdbcInfo](database-service.md#....typejdbcconnection.jsondefinitionsjdbcinfo)
* **ingestionSchedule**
  * Schedule for running metadata ingestion jobs.
  * $ref: [../../type/schedule.json](database-service.md#....typeschedule.json)

## Types defined in this schema

**databaseServiceType**

* Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres...
* Type: `string`
* The value is restricted to the following: 
  1. _"BigQuery"_
  2. _"MySQL"_
  3. _"Redshift"_
  4. _"Snowflake"_
  5. _"Postgres"_
  6. _"MSSQL"_
  7. _"Hive"_

