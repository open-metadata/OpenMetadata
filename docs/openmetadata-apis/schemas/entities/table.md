# Table

This schema defines the Table entity. A Table organizes data in rows and columns and is defined by a Schema. OpenMetadata does not have a separate abstraction for Schema. Both Table and Schema are captured in this entity.

**$id: https://open-metadata.org/schema/entity/data/table.json**

Type: `object`

## Properties
 - **id** `required`
   - Unique identifier of this table instance.
   - $ref: [../../type/basic.json#/definitions/uuid](../types/basic.md#uuid)
 - **name** `required`
   - Name of a table. Expected to be unique within a database.
   - $ref: [#/definitions/tableName](#tablename)
 - **description**
   - Description of a table.
   - Type: `string`
 - **href**
   - Link to this table resource.
   - $ref: [../../type/basic.json#/definitions/href](../types/basic.md#href)
 - **tableType**
   - $ref: [#/definitions/tableType](#tabletype)
 - **fullyQualifiedName**
   - Fully qualified name of a table in the form `serviceName.databaseName.tableName`.
   - Type: `string`
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
 - **usageSummary**
   - Latest usage information for this table.
   - $ref: [../../type/usageDetails.json](../types/usagedetails.md)
 - **owner**
   - Owner of this table.
   - $ref: [../../type/entityReference.json](../types/entityreference.md)
 - **followers**
   - Followers of this table.
   - $ref: [../../type/entityReference.json#/definitions/entityReferenceList](../types/entityreference.md#entityreferencelist)
 - **database**
   - Reference to Database that contains this table.
   - $ref: [../../type/entityReference.json](../types/entityreference.md)
 - **viewDefinition**
   - View Definition in SQL. Applies to TableType.View only.
   - $ref: [../../type/basic.json#/definitions/sqlQuery](../types/basic.md#sqlquery)
 - **tags**
   - Tags for this table.
   - Type: `array`
     - **Items**
     - $ref: [../../type/tagLabel.json](../types/taglabel.md)
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


### columnDataType

 - This enum defines the type of data stored in a column.
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


### columnConstraint

 - This enum defines the type for column constraint.
 - Type: `string`
 - The value is restricted to the following: 
   1. _"NULL"_
   2. _"NOT_NULL"_
   3. _"UNIQUE"_
   4. _"PRIMARY_KEY"_
 - Default: _"NULL"_


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

 - Local name (not fully qualified name) of the column.
 - Type: `string`
 - The value must match this pattern: `^[^.]*$`
 - Length: between 1 and 64


### tableName

 - Local name (not fully qualified name) of a table.
 - Type: `string`
 - The value must match this pattern: `^[^.]*$`
 - Length: between 1 and 64


### fullyQualifiedColumnName

 - Fully qualified name of the column that includes `serviceName.databaseName.tableName.columnName`.
 - Type: `string`
 - Length: between 1 and 256


### column

 - This schema defines the type for a column in a table.
 - Type: `object`
 - **Properties**
   - **name** `required`
     - $ref: [#/definitions/columnName](#columnname)
   - **columnDataType** `required`
     - Data type of the column (int, date etc.).
     - $ref: [#/definitions/columnDataType](#columndatatype)
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
   - **columnConstraint**
     - Column level constraint.
     - $ref: [#/definitions/columnConstraint](#columnconstraint)
   - **ordinalPosition**
     - Ordinal position of the column.
     - Type: `integer`


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
 - **Properties**
   - **name**
     - Column Name.
     - Type: `string`
   - **uniqueCount**
     - No. of unique values in the column.
     - Type: `number`
   - **uniqueProportion**
     - Proportion of number of unique values in a column.
     - Type: `number`
   - **nullCount**
     - No.of null values in a column.
     - Type: `number`
   - **nullProportion**
     - No.of null value proportion in columns.
     - Type: `number`
       - **min**
         - Minimum value in a column.
         - Type: `string`
       - **max**
         - Maximum value in a column.
         - Type: `string`
       - **mean**
         - Avg value in a column.
         - Type: `string`
       - **median**
         - Median value in a column.
         - Type: `string`
       - **stddev**
         - Standard deviation of a column.
         - Type: `number`


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



_This document was updated on: Thursday, September 16, 2021_