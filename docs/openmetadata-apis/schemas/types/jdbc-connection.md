# JDBC connection

JDBC connection information

<b id="httpsgithub.comopen-metadataopenmetadatablobmaincatalog-rest-servicesrcmainresourcesjsonschematypejdbcconnection.json">&#36;id: https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json</b>

Type: `object`

## Properties
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json/properties/driverClass">driverClass</b> `required`
	 - JDBC driver class
	 - &#36;ref: [#/definitions/driverClass](#/definitions/driverClass)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json/properties/connectionUrl">connectionUrl</b> `required`
	 - JDBC connection URL
	 - &#36;ref: [#/definitions/connectionUrl](#/definitions/connectionUrl)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json/properties/userName">userName</b> `required`
	 - Login user name.
	 - Type: `string`
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json/properties/password">password</b> `required`
	 - Login password.
	 - Type: `string`


## Types definitions in this schema
**driverClass**

 - Type used for JDBC driver class
 - Type: `string`


**connectionUrl**

 - Type used for JDBC connection URL
 - Type: `string`
 - String format must be a "uri"


**jdbcInfo**

 - Type for capturing JDBC connector information
 - Type: `object`
 - **Properties**
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json/definitions/jdbcInfo/properties/driverClass">driverClass</b> `required`
		 - &#36;ref: [#/definitions/driverClass](#/definitions/driverClass)
		 - Default: _"com.amazon.redshift.jdbc42.Driver"_
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/type/jdbcConnection.json/definitions/jdbcInfo/properties/connectionUrl">connectionUrl</b> `required`
		 - &#36;ref: [#/definitions/connectionUrl](#/definitions/connectionUrl)


