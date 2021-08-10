# Database Service

This schema defines the Database Service entity, such as MySQL, BigQuery, Redshift, Postgres, or Snowflake. Alternative terms such as Database Cluster, Database Server instance are also used.

<b id="httpsgithub.comopen-metadataopenmetadatablobmaincatalog-rest-servicesrcmainresourcesjsonschemaentityservicesdatabaseservice.json">&#36;id: https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json</b>

Type: `object`

## Properties
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json/properties/id">id</b> `required`
	 - Unique identifier of this database service instance.
	 - &#36;ref: [../../type/basic.json#/definitions/uuid](#....typebasic.jsondefinitionsuuid)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json/properties/name">name</b> `required`
	 - Name that identifies this database service.
	 - Type: `string`
	 - Length: between 1 and 64
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json/properties/serviceType">serviceType</b> `required`
	 - Type of database service such as MySQL, BigQuery, Snowflake, Redshift, Postgres...
	 - &#36;ref: [#/definitions/databaseServiceType](#/definitions/databaseServiceType)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json/properties/description">description</b>
	 - Description of a database service instance.
	 - Type: `string`
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json/properties/href">href</b> `required`
	 - Link to the resource corresponding to this database service.
	 - &#36;ref: [../../type/basic.json#/definitions/href](#....typebasic.jsondefinitionshref)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json/properties/jdbc">jdbc</b> `required`
	 - JDBC connection information
	 - &#36;ref: [../../type/jdbcConnection.json#/definitions/jdbcInfo](#....typejdbcconnection.jsondefinitionsjdbcinfo)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/services/databaseService.json/properties/ingestionSchedule">ingestionSchedule</b>
	 - Schedule for running metadata ingestion jobs.
	 - &#36;ref: [../../type/schedule.json](#....typeschedule.json)


## Types defined in this schema
**databaseServiceType**

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


