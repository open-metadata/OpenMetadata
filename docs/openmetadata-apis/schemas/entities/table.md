# Table entity

_Schema corresponding to a table that belongs to a database_

Type: `object`

<i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json</i>

&#36;schema: [http://json-schema.org/draft-07/schema#](http://json-schema.org/draft-07/schema#)

<b id="httpsgithub.comopen-metadataopenmetadatablobmaincatalog-rest-servicesrcmainresourcesjsonschemaentitydatatable.json">&#36;id: https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json</b>

**Comment**<br/>_version 0.1.81_

**_Properties_**

 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/id">id</b>
	 - _Unique identifier that identifies this table instance_
	 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/id">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/id</i>
	 - &#36;ref: [../../type/basic.json#/definitions/uuid](#....typebasic.jsondefinitionsuuid)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/name">name</b> `required`
	 - _Name of the table. Expected to be unique with in a database_
	 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/name">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/name</i>
	 - &#36;ref: [#/definitions/tableName](#/definitions/tableName)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/description">description</b>
	 - _Description of the table_
	 - Type: `string`
	 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/description">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/description</i>
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/href">href</b>
	 - _Link to this table resource_
	 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/href">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/href</i>
	 - &#36;ref: [../../type/basic.json#/definitions/href](#....typebasic.jsondefinitionshref)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/tableType">tableType</b>
	 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/tableType">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/tableType</i>
	 - &#36;ref: [#/definitions/tableType](#/definitions/tableType)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/fullyQualifiedName">fullyQualifiedName</b>
	 - _Fully qualified name of the table in the form serviceName.databaseName.tableName_
	 - Type: `string`
	 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/fullyQualifiedName">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/fullyQualifiedName</i>
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/columns">columns</b> `required`
	 - _Columns in the table_
	 - Type: `array`
	 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/columns">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/columns</i>
		 - **_Items_**
		 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/columns/items">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/columns/items</i>
		 - &#36;ref: [#/definitions/column](#/definitions/column)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/tableConstraints">tableConstraints</b>
	 - _Table constraints_
	 - Type: `array`
	 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/tableConstraints">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/tableConstraints</i>
		 - **_Items_**
		 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/tableConstraints/items">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/tableConstraints/items</i>
		 - &#36;ref: [#/definitions/tableConstraint](#/definitions/tableConstraint)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/usageSummary">usageSummary</b>
	 - _Latest usage information for this table_
	 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/usageSummary">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/usageSummary</i>
	 - &#36;ref: [../../type/usageDetails.json](#....typeusagedetails.json)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/owner">owner</b>
	 - _Owner of this table_
	 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/owner">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/owner</i>
	 - &#36;ref: [../../type/entityReference.json](#....typeentityreference.json)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/followers">followers</b>
	 - _Followers of this table_
	 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/followers">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/followers</i>
	 - &#36;ref: [../../type/entityReference.json#/definitions/entityReferenceList](#....typeentityreference.jsondefinitionsentityreferencelist)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/database">database</b>
	 - _Reference to Database that contains this table_
	 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/database">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/database</i>
	 - &#36;ref: [../../type/entityReference.json](#....typeentityreference.json)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/tags">tags</b>
	 - _Tags for this table_
	 - Type: `array`
	 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/tags">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/tags</i>
		 - **_Items_**
		 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/tags/items">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/tags/items</i>
		 - &#36;ref: [../../type/tagLabel.json](#....typetaglabel.json)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/joins">joins</b>
	 - _Details of other tables this table is frequently joined with_
	 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/joins">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/joins</i>
	 - &#36;ref: [#/definitions/tableJoins](#/definitions/tableJoins)
 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/sampleData">sampleData</b>
	 - _Sample data for the table_
	 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/sampleData">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/properties/sampleData</i>
	 - &#36;ref: [#/definitions/tableData](#/definitions/tableData)
# definitions

**_tableType_**

 - _Type for capturing a column in a table_
 - Type: `string`
 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableType">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableType</i>
 - The value is restricted to the following: 
	 1. _"Regular"_
	 2. _"External"_
	 3. _"View"_
	 4. _"SecureView"_
	 5. _"MaterializedView"_


**_columnDataType_**

 - _Type for capturing a column in a table_
 - Type: `string`
 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/columnDataType">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/columnDataType</i>
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

 - _Column constraint_
 - Type: `string`
 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/columnConstraint">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/columnConstraint</i>
 - The value is restricted to the following: 
	 1. _"NULL"_
	 2. _"NOT_NULL"_
	 3. _"UNIQUE"_
	 4. _"PRIMARY_KEY"_
 - Default: _"NULL"_


**_tableConstraint_**

 - _Table constraint_
 - Type: `object`
 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableConstraint">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableConstraint</i>
 - **_Properties_**
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableConstraint/properties/constraintType">constraintType</b>
		 - Type: `string`
		 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableConstraint/properties/constraintType">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableConstraint/properties/constraintType</i>
		 - The value is restricted to the following: 
			 1. _"UNIQUE"_
			 2. _"PRIMARY_KEY"_
			 3. _"FOREIGN_KEY"_
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableConstraint/properties/columns">columns</b>
		 - _List of column names corresponding to the constraint_
		 - Type: `array`
		 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableConstraint/properties/columns">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableConstraint/properties/columns</i>
			 - **_Items_**
			 - Type: `string`
			 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableConstraint/properties/columns/items">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableConstraint/properties/columns/items</i>


**_columnName_**

 - _Local name (not fully qualified name) of the column_
 - Type: `string`
 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/columnName">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/columnName</i>
 - The value must match this pattern: `^[^.]*$`
 - Length: between 1 and 64


**_tableName_**

 - _Local name (not fully qualified name) of the table_
 - Type: `string`
 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableName">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableName</i>
 - The value must match this pattern: `^[^.]*$`
 - Length: between 1 and 64


**_fullyQualifiedColumnName_**

 - _Fully qualified name of the column that includes serviceName.databaseName.tableName.columnName_
 - Type: `string`
 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/fullyQualifiedColumnName">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/fullyQualifiedColumnName</i>
 - Length: between 1 and 256


**_column_**

 - _Type for capturing a column in a table_
 - Type: `object`
 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/column">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/column</i>
 - **_Properties_**
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/column/properties/name">name</b> `required`
		 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/column/properties/name">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/column/properties/name</i>
		 - &#36;ref: [#/definitions/columnName](#/definitions/columnName)
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/column/properties/columnDataType">columnDataType</b> `required`
		 - _Data type of the column (int, date etc.)_
		 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/column/properties/columnDataType">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/column/properties/columnDataType</i>
		 - &#36;ref: [#/definitions/columnDataType](#/definitions/columnDataType)
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/column/properties/description">description</b>
		 - _Description of the column_
		 - Type: `string`
		 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/column/properties/description">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/column/properties/description</i>
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/column/properties/fullyQualifiedName">fullyQualifiedName</b>
		 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/column/properties/fullyQualifiedName">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/column/properties/fullyQualifiedName</i>
		 - &#36;ref: [#/definitions/fullyQualifiedColumnName](#/definitions/fullyQualifiedColumnName)
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/column/properties/tags">tags</b>
		 - _Tags associated with the column_
		 - Type: `array`
		 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/column/properties/tags">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/column/properties/tags</i>
			 - **_Items_**
			 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/column/properties/tags/items">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/column/properties/tags/items</i>
			 - &#36;ref: [../../type/tagLabel.json](#....typetaglabel.json)
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/column/properties/columnConstraint">columnConstraint</b>
		 - _Column level constraint_
		 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/column/properties/columnConstraint">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/column/properties/columnConstraint</i>
		 - &#36;ref: [#/definitions/columnConstraint](#/definitions/columnConstraint)
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/column/properties/ordinalPosition">ordinalPosition</b>
		 - _Ordinal position of the column_
		 - Type: `integer`
		 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/column/properties/ordinalPosition">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/column/properties/ordinalPosition</i>


**_columnJoins_**

 - _Information on other tables that this table column is frequently joined with_
 - Type: `object`
 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/columnJoins">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/columnJoins</i>
 - This schema <u>does not</u> accept additional properties.
 - **_Properties_**
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/columnJoins/properties/columnName">columnName</b>
		 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/columnJoins/properties/columnName">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/columnJoins/properties/columnName</i>
		 - &#36;ref: [#/definitions/columnName](#/definitions/columnName)
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/columnJoins/properties/joinedWith">joinedWith</b>
		 - _Fully qualified names of the columns that this column is joined with_
		 - Type: `array`
		 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/columnJoins/properties/joinedWith">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/columnJoins/properties/joinedWith</i>
			 - **_Items_**
			 - Type: `object`
			 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/columnJoins/properties/joinedWith/items">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/columnJoins/properties/joinedWith/items</i>
			 - **_Properties_**
				 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/columnJoins/properties/joinedWith/items/properties/fullyQualifiedName">fullyQualifiedName</b>
					 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/columnJoins/properties/joinedWith/items/properties/fullyQualifiedName">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/columnJoins/properties/joinedWith/items/properties/fullyQualifiedName</i>
					 - &#36;ref: [#/definitions/fullyQualifiedColumnName](#/definitions/fullyQualifiedColumnName)
				 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/columnJoins/properties/joinedWith/items/properties/joinCount">joinCount</b>
					 - Type: `integer`
					 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/columnJoins/properties/joinedWith/items/properties/joinCount">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/columnJoins/properties/joinedWith/items/properties/joinCount</i>


**_tableJoins_**

 - Type: `object`
 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableJoins">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableJoins</i>
 - This schema <u>does not</u> accept additional properties.
 - **_Properties_**
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableJoins/properties/startDate">startDate</b>
		 - _Date can be only from today going back to last 29 days_
		 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableJoins/properties/startDate">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableJoins/properties/startDate</i>
		 - &#36;ref: [../../type/basic.json#/definitions/date](#....typebasic.jsondefinitionsdate)
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableJoins/properties/dayCount">dayCount</b>
		 - Type: `integer`
		 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableJoins/properties/dayCount">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableJoins/properties/dayCount</i>
		 - Default: `1`
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableJoins/properties/columnJoins">columnJoins</b>
		 - Type: `array`
		 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableJoins/properties/columnJoins">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableJoins/properties/columnJoins</i>
			 - **_Items_**
			 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableJoins/properties/columnJoins/items">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableJoins/properties/columnJoins/items</i>
			 - &#36;ref: [#/definitions/columnJoins](#/definitions/columnJoins)


**_tableData_**

 - _Information on other tables that this table column is frequently joined with_
 - Type: `object`
 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableData">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableData</i>
 - This schema <u>does not</u> accept additional properties.
 - **_Properties_**
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableData/properties/columns">columns</b>
		 - _List of local column names (not fully qualified column names) of the table_
		 - Type: `array`
		 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableData/properties/columns">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableData/properties/columns</i>
			 - **_Items_**
			 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableData/properties/columns/items">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableData/properties/columns/items</i>
			 - &#36;ref: [#/definitions/columnName](#/definitions/columnName)
	 - <b id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableData/properties/rows">rows</b>
		 - _Data for a multiple rows of the table_
		 - Type: `array`
		 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableData/properties/rows">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableData/properties/rows</i>
			 - **_Items_**
			 - _Data for a single row of the table with in the same order as columns fields_
			 - Type: `array`
			 - <i id="#https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableData/properties/rows/items">path: #https://github.com/open-metadata/OpenMetadata/blob/main/catalog-rest-service/src/main/resources/json/schema/entity/data/table.json/definitions/tableData/properties/rows/items</i>



_Generated with [json-schema-md-doc](https://brianwendt.github.io/json-schema-md-doc/)_ _Mon Aug 09 2021 11:07:08 GMT-0700 (Pacific Daylight Time)_