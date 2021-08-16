# Database Service

This schema defines the Database Service entity, such as MySQL, BigQuery, Redshift, Postgres, or Snowflake. Alternative terms such as Database Cluster, Database Server instance are also used.

**$id:** [**https://open-metadata.org/schema/entity/services/databaseService.json**](https://open-metadata.org/schema/entity/services/databaseService.json)

Type: `object`

## Properties

* **id** `required`
  * Unique identifier of this database service instance.
  * $ref: [../../type/basic.json\#/definitions/uuid](../types/basic.md#types-definitions-in-this-schema)
* **name** `required`
  * Name that identifies this database service.
  * Type: `string`
  * Length: between 1 and 64
* **serviceType** `required`
  * Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres...
  * $ref: [\#/definitions/databaseServiceType](database-service.md#types-definitions-in-this-schema)
* **description**
  * Description of a database service instance.
  * Type: `string`
* **href** `required`
  * Link to the resource corresponding to this database service.
  * $ref: [../../type/basic.json\#/definitions/href](../types/basic.md#types-definitions-in-this-schema)
* **jdbc** `required`
  * JDBC connection information
  * $ref: [../../type/jdbcConnection.json\#/definitions/jdbcInfo](../types/jdbc-connection.md#types-definitions-in-this-schema)
* **ingestionSchedule**
  * Schedule for running metadata ingestion jobs.
  * $ref: [../../type/schedule.json](../types/schedule.md)

## Types definitions in this schema

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

