# Database Service

This schema defines the Database Service entity, such as MySQL, BigQuery, Redshift, Postgres, or Snowflake. Alternative terms such as Database Cluster, Database Server instance are also used for database service.

**$id:**[**https://open-metadata.org/schema/entity/services/databaseService.json**](https://open-metadata.org/schema/entity/services/databaseService.json)

Type: `object`

## Properties
- **id** `required`
  - Unique identifier of this database service instance.
  - $ref: [../../type/basic.json#/definitions/uuid](../types/basic.md#uuid)
- **name** `required`
  - Name that identifies this database service.
  - Type: `string`
  - Length: between 1 and 64
- **displayName**
  - Display Name that identifies this database service.
  - Type: `string`
- **serviceType** `required`
  - Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres...
  - $ref: [#/definitions/databaseServiceType](#databaseservicetype)
- **description**
  - Description of a database service instance.
  - Type: `string`
- **version**
  - Metadata version of the entity.
  - $ref: [../../type/entityHistory.json#/definitions/entityVersion](../types/entityhistory.md#entityversion)
- **updatedAt**
  - Last update time corresponding to the new version of the entity.
  - $ref: [../../type/basic.json#/definitions/dateTime](../types/basic.md#datetime)
- **updatedBy**
  - User who made the update.
  - Type: `string`
- **href** `required`
  - Link to the resource corresponding to this database service.
  - $ref: [../../type/basic.json#/definitions/href](../types/basic.md#href)
- **jdbc** `required`
  - JDBC connection information.
  - $ref: [../../type/jdbcConnection.json#/definitions/jdbcInfo](../types/jdbcconnection.md#jdbcinfo)
- **ingestionSchedule**
  - Schedule for running metadata ingestion jobs.
  - $ref: [../../type/schedule.json](../types/schedule.md)
- **changeDescription**
  - Change that lead to this version of the entity.
  - $ref: [../../type/entityHistory.json#/definitions/changeDescription](../types/entityhistory.md#changedescription)


## Type definitions in this schema

### databaseServiceType

- Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres...
- Type: `string`
- The value is restricted to the following: 
  1. _"BigQuery"_
  2. _"MySQL"_
  3. _"Redshift"_
  4. _"Snowflake"_
  5. _"Postgres"_
  6. _"MSSQL"_
  7. _"Hive"_
  8. _"Oracle"_
  9. _"Athena"_
  10. _"Presto"_
  11. _"Trino"_
  12. _"Vertica"_
  13. _"Glue"_


_This document was updated on: Monday, November 15, 2021_