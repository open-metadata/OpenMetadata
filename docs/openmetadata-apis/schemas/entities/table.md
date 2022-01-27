# Table

This schema defines the Table entity. A Table organizes data in rows and columns and is defined by a Schema. OpenMetadata does not have a separate abstraction for Schema. Both Table and Schema are captured in this entity.

**$id:**[**https://open-metadata.org/schema/entity/data/table.json**](https://open-metadata.org/schema/entity/data/table.json)

Type: `object`

This schema <u>does not</u> accept additional properties.

## Properties
 - **id** `required`
	 - Unique identifier of this table instance.
	 - $ref: [../../type/basic.json#/definitions/uuid](../types/basic.md#uuid)
 - **name** `required`
	 - Name of a table. Expected to be unique within a database.
	 - $ref: [#/definitions/tableName](#tablename)
 - **displayName**
	 - Display Name that identifies this table. It could be title or label from the source services.
	 - Type: `string`
 - **fullyQualifiedName**
	 - Fully qualified name of a table in the form `serviceName.databaseName.tableName`.
	 - Type: `string`
 - **description**
	 - Description of a table.
	 - Type: `string`
 - **version**
	 - Metadata version of the entity.
	 - $ref: [../../type/entityHistory.json#/definitions/entityVersion](../types/entityhistory.md#entityversion)
 - **updatedAt**
	 - Last update time corresponding to the new version of the entity in Unix epoch time milliseconds.
	 - $ref: [../../type/basic.json#/definitions/timestamp](../types/basic.md#timestamp)
 - **updatedBy**
	 - User who made the update.
	 - Type: `string`
 - **href**
	 - Link to this table resource.
	 - $ref: [../../type/basic.json#/definitions/href](../types/basic.md#href)
 - **tableType**
	 - $ref: [#/definitions/tableType](#tabletype)
 - **columns** `required`
	 - Columns in this table.
	 - Type: `array`
		 - **Items**
		 - $ref: [#/definitions/column](#column)
 - **tableConstraints**
	 - Table constraints.
	 - Type: `array`
		 - **Items**
		 - $ref: [#/definitions/tableConstraint](#tableconstraint)
 - **owner**
	 - Owner of this table.
	 - $ref: [../../type/entityReference.json](../types/entityreference.md)
 - **database**
	 - Reference to Database that contains this table.
	 - $ref: [../../type/entityReference.json](../types/entityreference.md)
 - **service**
	 - Link to Database service this table is hosted in.
	 - $ref: [../../type/entityReference.json](../types/entityreference.md)
 - **serviceType**
	 - Service type this table is hosted in.
	 - $ref: [../services/databaseService.json#/definitions/databaseServiceType](../services/databaseservice.md#databaseservicetype)
 - **location**
	 - Reference to the Location that contains this table.
	 - $ref: [../../type/entityReference.json](../types/entityreference.md)
 - **viewDefinition**
	 - View Definition in SQL. Applies to TableType.View only.
	 - $ref: [../../type/basic.json#/definitions/sqlQuery](../types/basic.md#sqlquery)
 - **tags**
	 - Tags for this table.
	 - Type: `array`
		 - **Items**
		 - $ref: [../../type/tagLabel.json](../types/taglabel.md)
 - **usageSummary**
	 - Latest usage information for this table.
	 - $ref: [../../type/usageDetails.json](../types/usagedetails.md)
 - **followers**
	 - Followers of this table.
	 - $ref: [../../type/entityReference.json#/definitions/entityReferenceList](../types/entityreference.md#entityreferencelist)
 - **joins**
	 - Details of other tables this table is frequently joined with.
	 - $ref: [#/definitions/tableJoins](#tablejoins)
 - **sampleData**
	 - Sample data for a table.
	 - $ref: [#/definitions/tableData](#tabledata)
 - **tableProfile**
	 - Data profile for a table.
	 - Type: `array`
		 - **Items**
		 - $ref: [#/definitions/tableProfile](#tableprofile)
 - **tableQueries**
	 - List of queries that ran against a table.
	 - Type: `array`
		 - **Items**
		 - $ref: [#/definitions/sqlQuery](#sqlquery)
 - **dataModel**
	 - This captures information about how the table is modeled. Currently only DBT model is supported.
	 - $ref: [#/definitions/dataModel](#datamodel)
 - **changeDescription**
	 - Change that lead to this version of the entity.
	 - $ref: [../../type/entityHistory.json#/definitions/changeDescription](../types/entityhistory.md#changedescription)
 - **deleted**
	 - When `true` indicates the entity has been soft deleted.
	 - Type: `boolean`
	 - Default: _false_


## Type definitions in this schema
### tableType

 - This schema defines the type used for describing different types of tables.
 - Type: `string`
 - The value is restricted to the following: 
	 1. _"Regular"_
	 2. _"External"_
	 3. _"View"_
	 4. _"SecureView"_
	 5. _"MaterializedView"_


### dataType

 - This enum defines the type of data stored in a column.
 - Type: `string`
 - The value is restricted to the following: 
	 1. _"NUMBER"_
	 2. _"TINYINT"_
	 3. _"SMALLINT"_
	 4. _"INT"_
	 5. _"BIGINT"_
	 6. _"BYTEINT"_
	 7. _"BYTES"_
	 8. _"FLOAT"_
	 9. _"DOUBLE"_
	 10. _"DECIMAL"_
	 11. _"NUMERIC"_
	 12. _"TIMESTAMP"_
	 13. _"TIME"_
	 14. _"DATE"_
	 15. _"DATETIME"_
	 16. _"INTERVAL"_
	 17. _"STRING"_
	 18. _"MEDIUMTEXT"_
	 19. _"TEXT"_
	 20. _"CHAR"_
	 21. _"VARCHAR"_
	 22. _"BOOLEAN"_
	 23. _"BINARY"_
	 24. _"VARBINARY"_
	 25. _"ARRAY"_
	 26. _"BLOB"_
	 27. _"LONGBLOB"_
	 28. _"MEDIUMBLOB"_
	 29. _"MAP"_
	 30. _"STRUCT"_
	 31. _"UNION"_
	 32. _"SET"_
	 33. _"GEOGRAPHY"_
	 34. _"ENUM"_
	 35. _"JSON"_


### constraint

 - This enum defines the type for column constraint.
 - Type: `string`
 - The value is restricted to the following: 
	 1. _"NULL"_
	 2. _"NOT_NULL"_
	 3. _"UNIQUE"_
	 4. _"PRIMARY_KEY"_


### tableConstraint

 - This enum defines the type for table constraint.
 - Type: `object`
 - **Properties**
	 - **constraintType**
		 - Type: `string`
		 - The value is restricted to the following: 
			 1. _"UNIQUE"_
			 2. _"PRIMARY_KEY"_
			 3. _"FOREIGN_KEY"_
	 - **columns**
		 - List of column names corresponding to the constraint.
		 - Type: `array`
			 - **Items**
			 - Type: `string`


### columnName

 - Local name (not fully qualified name) of the column. ColumnName is `-` when the column is not named in struct dataType. For example, BigQuery supports struct with unnamed fields.
 - Type: `string`
 - The value must match this pattern: `^[^.]*$`
 - Length: between 1 and 128


### tableName

 - Local name (not fully qualified name) of a table.
 - Type: `string`
 - The value must match this pattern: `^[^.]*$`
 - Length: between 1 and 128


### fullyQualifiedColumnName

 - Fully qualified name of the column that includes `serviceName.databaseName.tableName.columnName[.nestedColumnName]`. When columnName is null for dataType struct fields, `field_#` where `#` is field index is used. For map dataType, for key the field name `key` is used and for the value field `value` is used.
 - Type: `string`
 - Length: between 1 and 256


### column

 - This schema defines the type for a column in a table.
 - Type: `object`
 - This schema <u>does not</u> accept additional properties.
 - **Properties**
	 - **name** `required`
		 - $ref: [#/definitions/columnName](#columnname)
	 - **dataType** `required`
		 - Data type of the column (int, date etc.).
		 - $ref: [#/definitions/dataType](#datatype)
	 - **arrayDataType**
		 - Data type used array in dataType. For example, `array<int>` has dataType as `array` and arrayDataType as `int`.
		 - $ref: [#/definitions/dataType](#datatype)
	 - **dataLength**
		 - Length of `char`, `varchar`, `binary`, `varbinary` `dataTypes`, else null. For example, `varchar(20)` has dataType as `varchar` and dataLength as `20`.
		 - Type: `integer`
	 - **dataTypeDisplay**
		 - Display name used for dataType. This is useful for complex types, such as `array<int>, map<int,string>, struct<>, and union types.
		 - Type: `string`
	 - **description**
		 - Description of the column.
		 - Type: `string`
	 - **fullyQualifiedName**
		 - $ref: [#/definitions/fullyQualifiedColumnName](#fullyqualifiedcolumnname)
	 - **tags**
		 - Tags associated with the column.
		 - Type: `array`
			 - **Items**
			 - $ref: [../../type/tagLabel.json](../types/taglabel.md)
	 - **constraint**
		 - Column level constraint.
		 - $ref: [#/definitions/constraint](#constraint)
	 - **ordinalPosition**
		 - Ordinal position of the column.
		 - Type: `integer`
	 - **jsonSchema**
		 - Json schema only if the dataType is JSON else null.
		 - Type: `string`
	 - **children**
		 - Child columns if dataType or arrayDataType is `map`, `struct`, or `union` else `null`.
		 - Type: `array`
			 - **Items**
			 - $ref: [#/definitions/column](#column)


### columnJoins

 - This schema defines the type to capture how frequently a column is joined with columns in the other tables.
 - Type: `object`
 - This schema <u>does not</u> accept additional properties.
 - **Properties**
	 - **columnName**
		 - $ref: [#/definitions/columnName](#columnname)
	 - **joinedWith**
		 - Fully qualified names of the columns that this column is joined with.
		 - Type: `array`
			 - **Items**
			 - Type: `object`
			 - **Properties**
				 - **fullyQualifiedName**
					 - $ref: [#/definitions/fullyQualifiedColumnName](#fullyqualifiedcolumnname)
				 - **joinCount**
					 - Type: `integer`


### tableJoins

 - This schema defines the type to capture information about how columns in this table are joined with columns in the other tables.
 - Type: `object`
 - This schema <u>does not</u> accept additional properties.
 - **Properties**
	 - **startDate**
		 - Date can be only from today going back to last 29 days.
		 - $ref: [../../type/basic.json#/definitions/date](../types/basic.md#date)
	 - **dayCount**
		 - Type: `integer`
		 - Default: `1`
	 - **columnJoins**
		 - Type: `array`
			 - **Items**
			 - $ref: [#/definitions/columnJoins](#columnjoins)


### tableData

 - This schema defines the type to capture rows of sample data for a table.
 - Type: `object`
 - This schema <u>does not</u> accept additional properties.
 - **Properties**
	 - **columns**
		 - List of local column names (not fully qualified column names) of the table.
		 - Type: `array`
			 - **Items**
			 - $ref: [#/definitions/columnName](#columnname)
	 - **rows**
		 - Data for multiple rows of the table.
		 - Type: `array`
			 - **Items**
			 - Data for a single row of the table within the same order as columns fields.
			 - Type: `array`


### columnProfile

 - This schema defines the type to capture the table's column profile.
 - Type: `object`
 - This schema <u>does not</u> accept additional properties.
 - **Properties**
	 - **name**
		 - Column Name.
		 - Type: `string`
	 - **valuesCount**
		 - Total count of the values in this column.
		 - Type: `number`
	 - **valuesPercentage**
		 - Percentage of values in this column with respect to rowcount.
		 - Type: `number`
	 - **validCount**
		 - Total count of valid values in this column.
		 - Type: `number`
	 - **duplicateCount**
		 - No.of Rows that contain duplicates in a column.
		 - Type: `number`
	 - **nullCount**
		 - No.of null values in a column.
		 - Type: `number`
	 - **nullProportion**
		 - No.of null value proportion in columns.
		 - Type: `number`
	 - **missingPercentage**
		 - Missing Percentage is calculated by taking percentage of validCount/valuesCount.
		 - Type: `number`
	 - **missingCount**
		 - Missing count is calculated by subtracting valuesCount - validCount.
		 - Type: `number`
	 - **uniqueCount**
		 - No. of unique values in the column.
		 - Type: `number`
	 - **uniqueProportion**
		 - Proportion of number of unique values in a column.
		 - Type: `number`
	 - **distinctCount**
		 - Number of values that contain distinct values.
		 - Type: `number`
	 - **min**
		 - Minimum value in a column.
		 - Type: `number`
	 - **max**
		 - Maximum value in a column.
		 - Type: `number`
	 - **mean**
		 - Avg value in a column.
		 - Type: `number`
	 - **sum**
		 - Median value in a column.
		 - Type: `number`
	 - **stddev**
		 - Standard deviation of a column.
		 - Type: `number`
	 - **variance**
		 - Variance of a column.
		 - Type: `number`
	 - **histogram**
		 - Histogram of a column.


### tableProfile

 - This schema defines the type to capture the table's data profile.
 - Type: `object`
 - This schema <u>does not</u> accept additional properties.
 - **Properties**
	 - **profileDate**
		 - Data one which profile is taken.
		 - $ref: [../../type/basic.json#/definitions/date](../types/basic.md#date)
	 - **columnCount**
		 - No.of columns in the table.
		 - Type: `number`
	 - **rowCount**
		 - No.of rows in the table.
		 - Type: `number`
	 - **columnProfile**
		 - List of local column profiles of the table.
		 - Type: `array`
			 - **Items**
			 - $ref: [#/definitions/columnProfile](#columnprofile)


### sqlQuery

 - This schema defines the type to capture the table's sql queries.
 - Type: `object`
 - **Properties**
	 - **query**
		 - SQL Query text that matches the table name.
		 - Type: `string`
	 - **duration**
		 - How long did the query took to run in seconds.
		 - Type: `number`
	 - **user**
		 - User who ran this query.
		 - $ref: [../../type/entityReference.json](../types/entityreference.md)
	 - **vote**
		 - Users can vote up to rank the popular queries.
		 - Type: `number`
		 - Default: `1`
	 - **checksum**
		 - Checksum to avoid registering duplicate queries.
		 - Type: `string`
	 - **queryDate**
		 - Date on which the query ran.
		 - $ref: [../../type/basic.json#/definitions/date](../types/basic.md#date)


### modelType

 - The value is restricted to the following: 
	 1. _"DBT"_


### dataModel

 - This captures information about how the table is modeled. Currently only DBT model is supported.
 - Type: `object`
 - **Properties**
	 - **modelType** `required`
		 - $ref: [#/definitions/modelType](#modeltype)
	 - **description**
		 - Description of the Table from the model.
		 - Type: `string`
	 - **path**
		 - Path to sql definition file.
		 - Type: `string`
	 - **rawSql**
		 - This corresponds to rws SQL from `<model_name>.sql` in DBT. This might be null when SQL query need not be compiled as done in DBT.
		 - $ref: [../../type/basic.json#/definitions/sqlQuery](../types/basic.md#sqlquery)
	 - **sql** `required`
		 - This corresponds to compile SQL from `<model_name>.sql` in DBT. In cases where compilation is not necessary, this corresponds to SQL that created the table.
		 - $ref: [../../type/basic.json#/definitions/sqlQuery](../types/basic.md#sqlquery)
	 - **upstream**
		 - Fully qualified name of Models/tables used for in `sql` for creating this table.
		 - Type: `array`
			 - **Items**
			 - Type: `string`
	 - **columns**
		 - Columns from the schema defined during modeling. In case of DBT, the metadata here comes from `schema.yaml`.
		 - Type: `array`
			 - **Items**
			 - $ref: [#/definitions/column](#column)
	 - **generatedAt**
		 - $ref: [../../type/basic.json#/definitions/dateTime](../types/basic.md#datetime)




_This document was updated on: Tuesday, January 25, 2022_