# Table

This schema defines Table entity. Database contains a collection of schemas. Schemas contain Tables, Views, etc. OpenMetadata does not have a separate hierarchy for Schema. Both Table and Schema are captured in this entity.

<b id="httpsgithub.comopen-metadataopenmetadatablobmaincatalog-rest-servicesrcmainresourcesjsonschemaentitydatatable.json">&#36;id: https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json</b>

Type: `object`

## Properties
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/id">id</b> `required`
	 - Unique identifier of this table instance.
	 - &#36;ref: [../../type/basic.json#/definitions/uuid](#....typebasic.jsondefinitionsuuid)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/name">name</b> `required`
	 - Name of the table. Expected to be unique with in a database.
	 - &#36;ref: [#/definitions/tableName](#/definitions/tableName)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/description">description</b>
	 - Description of the table.
	 - Type: `string`
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/href">href</b>
	 - Link to this table resource.
	 - &#36;ref: [../../type/basic.json#/definitions/href](#....typebasic.jsondefinitionshref)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/tableType">tableType</b>
	 - &#36;ref: [#/definitions/tableType](#/definitions/tableType)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/fullyQualifiedName">fullyQualifiedName</b>
	 - Fully qualified name of the table in the form `serviceName.databaseName.tableName`.
	 - Type: `string`
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/columns">columns</b> `required`
	 - Columns in this table.
	 - Type: `array`
		 - **_Items_**
		 - &#36;ref: [#/definitions/column](#/definitions/column)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/tableConstraints">tableConstraints</b>
	 - Table constraints.
	 - Type: `array`
		 - **_Items_**
		 - &#36;ref: [#/definitions/tableConstraint](#/definitions/tableConstraint)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/usageSummary">usageSummary</b>
	 - Latest usage information for this table.
	 - &#36;ref: [../../type/usageDetails.json](#....typeusagedetails.json)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/owner">owner</b>
	 - Owner of this table.
	 - &#36;ref: [../../type/entityReference.json](#....typeentityreference.json)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/followers">followers</b>
	 - Followers of this table.
	 - &#36;ref: [../../type/entityReference.json#/definitions/entityReferenceList](#....typeentityreference.jsondefinitionsentityreferencelist)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/database">database</b>
	 - Reference to Database that contains this table.
	 - &#36;ref: [../../type/entityReference.json](#....typeentityreference.json)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/tags">tags</b>
	 - Tags for this table.
	 - Type: `array`
		 - **_Items_**
		 - &#36;ref: [../../type/tagLabel.json](#....typetaglabel.json)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/joins">joins</b>
	 - Details of other tables this table is frequently joined with.
	 - &#36;ref: [#/definitions/tableJoins](#/definitions/tableJoins)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/sampleData">sampleData</b>
	 - Sample data for the table.
	 - &#36;ref: [#/definitions/tableData](#/definitions/tableData)


## Definitions
**_tableType_**

 - This schema defines the type for a column in a table.
 - Type: `string`
 - The value is restricted to the following: 
	 1. _"Regular"_
	 2. _"External"_
	 3. _"View"_
	 4. _"SecureView"_
	 5. _"MaterializedView"_


**_columnDataType_**

 - This enum defines the type for column data type.
 - Type: `string`
 - The value is restricted to the following: 
	 1. _"NUMBER"_
	 2. _"TINYINT"_
	 3. _"SMALLINT"_
	 4. _"INT"_
	 5. _"BIGINT"_
	 6. _"FLOAT"_
	 7. _"DOUBLE"_
	 8. _"DECIMAL"_
	 9. _"NUMERIC"_
	 10. _"TIMESTAMP"_
	 11. _"TIME"_
	 12. _"DATE"_
	 13. _"DATETIME"_
	 14. _"INTERVAL"_
	 15. _"STRING"_
	 16. _"MEDIUMTEXT"_
	 17. _"TEXT"_
	 18. _"CHAR"_
	 19. _"VARCHAR"_
	 20. _"BOOLEAN"_
	 21. _"BINARY"_
	 22. _"VARBINARY"_
	 23. _"ARRAY"_
	 24. _"BLOB"_
	 25. _"LONGBLOB"_
	 26. _"MEDIUMBLOB"_
	 27. _"MAP"_
	 28. _"STRUCT"_
	 29. _"UNION"_
	 30. _"SET"_
	 31. _"GEOGRAPHY"_
	 32. _"ENUM"_
	 33. _"JSON"_


**_columnConstraint_**

 - This enum defines the type for column constraint.
 - Type: `string`
 - The value is restricted to the following: 
	 1. _"NULL"_
	 2. _"NOT_NULL"_
	 3. _"UNIQUE"_
	 4. _"PRIMARY_KEY"_
 - Default: _"NULL"_


**_tableConstraint_**

 - This enum defines the type for table constraint.
 - Type: `object`
 - **_Properties_**
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableConstraint/properties/constraintType">constraintType</b>
		 - Type: `string`
		 - The value is restricted to the following: 
			 1. _"UNIQUE"_
			 2. _"PRIMARY_KEY"_
			 3. _"FOREIGN_KEY"_
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableConstraint/properties/columns">columns</b>
		 - List of column names corresponding to the constraint.
		 - Type: `array`
			 - **_Items_**
			 - Type: `string`


**_columnName_**

 - Local name (not fully qualified name) of the column.
 - Type: `string`
 - The value must match this pattern: `^[^.]*$`
 - Length: between 1 and 64


**_tableName_**

 - Local name (not fully qualified name) of the table.
 - Type: `string`
 - The value must match this pattern: `^[^.]*$`
 - Length: between 1 and 64


**_fullyQualifiedColumnName_**

 - Fully qualified name of the column that includes `serviceName.databaseName.tableName.columnName`.
 - Type: `string`
 - Length: between 1 and 256


**_column_**

 - This schema defines the type for a column in a table.
 - Type: `object`
 - **_Properties_**
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/column/properties/name">name</b> `required`
		 - &#36;ref: [#/definitions/columnName](#/definitions/columnName)
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/column/properties/columnDataType">columnDataType</b> `required`
		 - Data type of the column (int, date etc.).
		 - &#36;ref: [#/definitions/columnDataType](#/definitions/columnDataType)
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/column/properties/description">description</b>
		 - Description of the column.
		 - Type: `string`
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/column/properties/fullyQualifiedName">fullyQualifiedName</b>
		 - &#36;ref: [#/definitions/fullyQualifiedColumnName](#/definitions/fullyQualifiedColumnName)
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/column/properties/tags">tags</b>
		 - Tags associated with the column.
		 - Type: `array`
			 - **_Items_**
			 - &#36;ref: [../../type/tagLabel.json](#....typetaglabel.json)
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/column/properties/columnConstraint">columnConstraint</b>
		 - Column level constraint.
		 - &#36;ref: [#/definitions/columnConstraint](#/definitions/columnConstraint)
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/column/properties/ordinalPosition">ordinalPosition</b>
		 - Ordinal position of the column.
		 - Type: `integer`


**_columnJoins_**

 - This schema defines the type to capture how frequently a column in this table is joined with columns in the other tables.
 - Type: `object`
 - This schema <u>does not</u> accept additional properties.
 - **_Properties_**
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/columnJoins/properties/columnName">columnName</b>
		 - &#36;ref: [#/definitions/columnName](#/definitions/columnName)
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/columnJoins/properties/joinedWith">joinedWith</b>
		 - Fully qualified names of the columns that this column is joined with.
		 - Type: `array`
			 - **_Items_**
			 - Type: `object`
			 - **_Properties_**
				 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/columnJoins/properties/joinedWith/items/properties/fullyQualifiedName">fullyQualifiedName</b>
					 - &#36;ref: [#/definitions/fullyQualifiedColumnName](#/definitions/fullyQualifiedColumnName)
				 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/columnJoins/properties/joinedWith/items/properties/joinCount">joinCount</b>
					 - Type: `integer`


**_tableJoins_**

 - This schema defines the type to capture how columns in this table is joined with columns in the other tables.
 - Type: `object`
 - This schema <u>does not</u> accept additional properties.
 - **_Properties_**
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableJoins/properties/startDate">startDate</b>
		 - Date can be only from today going back to last 29 days.
		 - &#36;ref: [../../type/basic.json#/definitions/date](#....typebasic.jsondefinitionsdate)
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableJoins/properties/dayCount">dayCount</b>
		 - Type: `integer`
		 - Default: `1`
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableJoins/properties/columnJoins">columnJoins</b>
		 - Type: `array`
			 - **_Items_**
			 - &#36;ref: [#/definitions/columnJoins](#/definitions/columnJoins)


**_tableData_**

 - This schema defines the type to capture rows of sample data for the table.
 - Type: `object`
 - This schema <u>does not</u> accept additional properties.
 - **_Properties_**
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableData/properties/columns">columns</b>
		 - List of local column names (not fully qualified column names) of the table.
		 - Type: `array`
			 - **_Items_**
			 - &#36;ref: [#/definitions/columnName](#/definitions/columnName)
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableData/properties/rows">rows</b>
		 - Data for a multiple rows of the table.
		 - Type: `array`
			 - **_Items_**
			 - Data for a single row of the table with in the same order as columns fields.
			 - Type: `array`



_Generated with [json-schema-md-doc](https://brianwendt.github.io/json-schema-md-doc/)_ _Mon Aug 09 2021 18:41:36 GMT-0700 (Pacific Daylight Time)_