# Database Service

This schema defines the Database Service entity, such as MySQL, BigQuery, Redshift, Postgres, or Snowflake. Alternative terms such as Database Cluster, Database Server instance are also used for database service.

**$id:**[**https://open-metadata.org/schema/entity/services/databaseService.json**](https://open-metadata.org/schema/entity/services/databaseService.json)

Type: `object`

This schema <u>does not</u> accept additional properties.

## Properties
 - **id** `required`
	 - Unique identifier of this database service instance.
	 - $ref: [../../type/basic.json#/definitions/uuid](../types/basic.md#uuid)
 - **name** `required`
	 - Name that identifies this database service.
	 - Type: `string`
	 - The value must match this pattern: `^[^.]*$`
	 - Length: between 1 and 128
 - **displayName**
	 - Display Name that identifies this database service.
	 - Type: `string`
 - **serviceType** `required`
	 - Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres...
	 - $ref: [#/definitions/databaseServiceType](#databaseservicetype)
 - **description**
	 - Description of a database service instance.
	 - Type: `string`
 - **databaseConnection** `required`
	 - $ref: [#/definitions/databaseConnection](#databaseconnection)
 - **airflowPipelines**
	 - References to airflow pipelines deployed for this database service.
	 - $ref: [../../type/entityReference.json#/definitions/entityReferenceList](../types/entityreference.md#entityreferencelist)
 - **version**
	 - Metadata version of the entity.
	 - $ref: [../../type/entityHistory.json#/definitions/entityVersion](../types/entityhistory.md#entityversion)
 - **updatedAt**
	 - Last update time corresponding to the new version of the entity in Unix epoch time milliseconds.
	 - $ref: [../../type/basic.json#/definitions/timestamp](../types/basic.md#timestamp)
 - **updatedBy**
	 - User who made the update.
	 - Type: `string`
 - **owner**
	 - Owner of this database service.
	 - $ref: [../../type/entityReference.json](../types/entityreference.md)
 - **href** `required`
	 - Link to the resource corresponding to this database service.
	 - $ref: [../../type/basic.json#/definitions/href](../types/basic.md#href)
 - **changeDescription**
	 - Change that lead to this version of the entity.
	 - $ref: [../../type/entityHistory.json#/definitions/changeDescription](../types/entityhistory.md#changedescription)
 - **deleted**
	 - When `true` indicates the entity has been soft deleted.
	 - Type: `boolean`
	 - Default: _false_


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
	 14. _"MariaDB"_
	 15. _"Druid"_
	 16. _"Db2"_
	 17. _"ClickHouse"_
	 18. _"Databricks"_
	 19. _"DynamoDB"_
	 20. _"AzureSQL"_
	 21. _"SingleStore"_
	 22. _"SQLite"_


### databaseConnection

 - Database Connection.
 - Type: `object`
 - This schema <u>does not</u> accept additional properties.
 - **Properties**
	 - **username**
		 - username to connect  to the data source.
		 - Type: `string`
	 - **password**
		 - password to connect  to the data source.
		 - Type: `string`
	 - **hostPort**
		 - Host and port of the data source.
		 - Type: `string`
	 - **database**
		 - Database of the data source.
		 - Type: `string`
	 - **connectionOptions**
		 - Additional connection options that can be sent to service during the connection.
		 - Type: `object`
	 - **connectionArguments**
		 - Additional connection arguments such as security or protocol configs that can be sent to service during connection.
		 - Type: `object`




_This document was updated on: Monday, March 7, 2022_