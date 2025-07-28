---
title: Tests - YAML Config | OpenMetadata Quality Config Guide
description: Define YAML tests to validate data quality during ingestion and enforce expectations at column or table level.
slug: /how-to-guides/data-quality-observability/quality/tests-yaml
---

# Tests in the YAML Config
Here you can see all the supported tests definitions and how to configure them in the YAML config file.

A **Test Definition** is a generic definition of a test. This Test Definition then gets specified in a Test Case. This Test Case is where the parameter(s) of a Test Definition are specified.

In this section, you will learn what tests we currently support and how to configure them in the YAML/JSON config file.

- [Table Tests](#table-tests)
- [Column Tests](#column-tests)

## Table Tests
Tests applied on top of a Table. Here is the list of all table tests:

- [Table Row Count to Equal](#table-row-count-to-equal)
- [Table Row Count to be Between](#table-row-count-to-be-between)
- [Table Column Count to Equal](#table-column-count-to-equal)
- [Table Column Count to be Between](#table-column-count-to-be-between)
- [Table Column Name to Exist](#table-column-name-to-exist)
- [Table Column to Match Set](#table-column-to-match-set)
- [Table Custom SQL Test](#table-custom-sql-test)
- [Table Row Inserted Count To Be Between](#table-row-inserted-count-to-be-between)
- [Compare 2 Tables for Differences](#compare-2-tables-for-differences)
- [Table Data to Be Fresh [Collate]](#table-data-to-be-fresh-collate)

### Table Row Count to Equal
Validate the total row count in the table is equal to the given value.

**Dimension**:
Integrity

**Properties**:

* `value`: Expected number of rows.

**Behavior**

| Condition                                                  | Status    |
|----------------------------------------------------------|---------|
| `value` **match** the number of rows in the table          | Success ✅ |
| `value` **does not match** the number of rows in the table | Failed ❌  |

**YAML Config**

```yaml
- name: myTestName
  description: test description
  testDefinitionName: tableRowCountToEqual
  parameterValues:
      - name: value
        value: 2
```

**JSON Config**

```json
{
    "name": "myTestName",
    "description": "test description",
    "testDefinitionName": "tableRowCountToEqual",
    "parameterValues": [
        {
            "name": "value",
            "value": 2
        }
    ]
}
```

### Table Row Count to be Between
Validate the total row count is within a given range of values.

**Dimension**:
Integrity

**Properties**:

* `minValue`: Lower bound of the interval. If informed, the number of rows should be bigger than this number.
* `maxValue`: Upper bound of the interval. If informed, the number of rows should be lower than this number.

Any of those two need to be informed.

**Behavior**

| Condition      | Status |
| ----------- | ----------- |
|The number of rows in the table **is between** `minValue` and `maxValue`| Success ✅|
|The number of rows in the table **is not between** `minValue` and `maxValue`|Failed ❌|

**YAML Config**

```yaml
- name: myTestName
  description: test description
  testDefinitionName: tableRowCountToBeBetween
  parameterValues:
    - name: minValue
      value: 10
    - name: maxValue
      value: 10
```

**JSON Config**

```json
{
    "name": "myTestName",
    "description": "test description",
    "testDefinitionName": "tableRowCountToBeBetween",
    "parameterValues": [
        {
            "name": "minValue",
            "value": 10
        },
        {
            "name": "maxValue",
            "value": 10
        }
    ]
}
```

### Table Column Count to Equal
Validate that the number of columns in a table is equal to a given value.

**Dimension**:
Integrity

**Properties**

* `columnCount`: Expected number of columns.

**Behavior**

| Condition      | Status |
| ----------- | ----------- |
|`columnCount` **matches** the number of column in the table| Success ✅|
|`columnCount` **does not matches** the number of column in the table|Failed ❌|

**YAML Config**

```yaml
- name: myTestName
  description: test description
  testDefinitionName: tableColumnCountToEqual
  parameterValues:
    - name: columnCount
      value: 5
```

**JSON Config**

```json
{
    "name": "myTestName",
    "description": "test description",
    "testDefinitionName": "tableColumnCountToEqual",
    "parameterValues": [
        {
            "name": "columnCount",
            "value": 5
        }
    ]
}
```

### Table Column Count to be Between
Validate the number of columns in a table is between the given value

**Dimension**:
Integrity

**Properties**

* `minColValue`: lower bound
* `maxColValue`: upper bound

**Behavior**

| Condition      | Status |
| ----------- | ----------- |
|The number of columns in the table **is between** `minColValue` and `maxColValue`| Success ✅|
|The number of columns in the table **is not between** `minColValue` and `maxColValue`|Failed ❌|

**YAML Config**

```yaml
- name: myTestName
  description: test description
  testDefinitionName: tableColumnCountToBeBetween
  parameterValues:
    - name: minColValue
      value: 5
    - name: maxColValue
      value: 10
```

**JSON Config**

```json
{
    "name": "myTestName",
    "description": "test description",
    "testDefinitionName": "tableColumnCountToBeBetween",
    "parameterValues": [
        {
            "name": "minColValue",
            "value": 5
        },
        {
            "name": "maxColValue",
            "value": 10
        }
    ]
}
```

### Table Column Name to Exist
Validate a column name is present in the table

**Dimension**:
Integrity

**Properties**

* `columnName`: the name of the column to check for

**Behavior**

| Condition      | Status |
| ----------- | ----------- |
|`columnName` **exists** in the set of column name for the table| Success ✅|
|`columnName` **does not exists** in the set of column name for the table|Failed ❌|

**YAML Config**

```yaml
- name: myTestName
  description: test description
  testDefinitionName: tableColumnNameToExist
  parameterValues:
    - name: columnName
      value: order_id
```

**JSON Config**

```json
{
    "myTestName": "myTestName",
    "testDefinitionName": "tableColumnNameToExist",
    "parameterValues": [
        {
            "name": "columnName",
            "value": "order_id"
        }
    ]
}
```

### Table Column to Match Set
Validate a list of table column name matches an expected set of columns

**Dimension**:
Integrity

**Properties**

* `columnNames`: comma separated string of column name
* `ordered`: whether the test should check for column ordering. Default to False

**Behavior**

| Condition      | Status |
| ----------- | ----------- |
|[`ordered=False`] `columnNames` **matches** the list of column names in the table **regardless of the order**|Success ✅|
|[`ordered=True`] `columnNames` **matches** the list of column names in the table **in the corresponding order** (e.g. `["a","b"] == ["a","b"]`| Success ✅|
|[`ordered=FALSE`] `columnNames` **does no match** the list of column names in the table **regardless of the order**|Failed ❌|
|[`ordered=True`] `columnNames` **does no match** the list of column names in the table **and/or the corresponding order** (e.g. `["a","b"] != ["b","a"]`|Failed ❌|

**YAML Config**

```yaml
- name: myTestName
  description: test description
  testDefinitionName: tableColumnToMatchSet
  parameterValues:
    - name: columnNames
      value: "col1, col2, col3"
    - name: ordered
      value: true
```

**JSON Config**

```json
{
    "myTestName": "myTestName",
    "testDefinitionName": "tableColumnToMatchSet",
    "parameterValues": [
        {
            "name": "columnNames",
            "value": "col1, col2, col3"
        },
        {
            "name": "ordered",
            "value": true
        }
    ]
}
```

### Table Custom SQL Test
Write you own SQL test. When writting your query you can use 2 strategies:
- `ROWS` (default): expects the query to be written as `SELECT <field>, <field> FROM <foo> WHERE <condition>`. **Note** if your query returns a large amount of rows it might cause an "Out Of Memeory" error. In this case we recomend you to use the `COUNT` strategy.
- `COUNT`: expects the query to be written as `SELECT COUNT(<field>) FROM <foo> WHERE <condition>`.

**How to use the Threshold Parameter?**
The threshold allows you to define a limit for which you test should pass or fail - by defaut this number is 0. For example if my custom SQL query test returns 10 rows (or a COUNT value of 10) and my threshold is 5 the test will fail. If I update my threshold to 11 on my next run my test will pass.

{% note %}

- When configuring a **Table Custom SQL Test**, specify the table using the format `database.schema.table`.
- Using only the table name may not work, as it depends on the SQL engine's requirements.

{% /note %}

**Properties**

* `sqlExpression`: SQL expression
* `strategy`: one of `ROWS` or `COUNT`
* `threshold`: an integer defining the threshold above which the test should fail (default to 0 if not specified)

**Behavior**

| Condition      | Status |
| ----------- | ----------- |
|`sqlExpression` returns **row <= threshold (default to 0)**|Success ✅|
|`sqlExpression` returns **row > threshold (default to 0)**|Failed ❌|

**Example**
```sql
SELECT 
customer_id
FROM DUAL 
WHERE lifetime_value < 0;
```

```sql
SELECT 
customer_id
FROM DUAL d
INNER JOIN OTHER o ON d.id = o.id
WHERE lifetime_value < 0;
```

**YAML Config**

```yaml
- name: myTestName
  description: test description
  testDefinitionName: tableCustomSQLQuery
  parameterValues:
    - name: sqlExpression
      value: >
        SELECT 
        customer_tier
        FROM DUAL 
        WHERE customer_tier = 'GOLD' and lifetime_value < 10000;
```

**JSON Config**

```json
{
    "name": "myTestName",
    "description": "test description",
    "testDefinitionName": "tableCustomSQLQuery",
    "parameterValues": [
        {
            "name": "sqlExpression",
            "value": "SELECT  customer_tier FROM DUAL  WHERE customer_tier = 'GOLD' and lifetime_value < 10000;"
        }
    ]
}
```

### Table Row Inserted Count To Be Between
Validate the number of rows inserted for the defined period is between the expected range

{% note %}

The Table Row Inserted Count To Be Between cannot be executed against tables that have configured a partition in OpenMetadata. The logic of the test performed will be similar to executing a Table Row Count to be Between test against a table with a partition configured.

{% /note %}

**Dimension**:
Integrity

**Properties**

* `Min Row Count`: Lower bound
* `Max Row Count`: Upper bound
* `Column Name`: The name of the column used to apply the range filter
* `Range Type`: One of `HOUR`, `DAY`, `MONTH`, `YEAR`
* `Interval`: The range interval (e.g. 1,2,3,4,5, etc)

**Behavior**

| Condition      | Status |
| ----------- | ----------- |
|Number of rows **is between** `Min Row Count` and `Max Row Count`| Success ✅|
|Number of rows **is not between** `Min Row Count` and `Max Row Count|Failed ❌|

**YAML Config**

```yaml
- name: myTestName
  description: test description
  testDefinitionName: tableRowInsertedCountToBeBetween
  parameterValues:
    - name: min
      value: 10
    - name: max
      value: 100
    - name: columnName
      value: colA
    - name: rangeType
      value: DAY
    - name: rangeInterval
      value: 1
```

**JSON Config**

```json
{
    "name": "myTestName",
    "description": "test description",
    "testDefinitionName": "tableRowInsertedCountToBeBetween",
    "parameterValues": [
        {
            "name": "min",
            "value": 10
        },
        {
            "name": "max",
            "value": 100
        },
        {
            "name": "columnName",
            "value": "colA"
        },
        {
            "name": "rangeType",
            "value": "DAY"
        },
        {
            "name": "rangeInterval",
            "value": 1
        }
    ]
}
```

### Compare 2 Tables for Differences
Compare 2 tables for differences. Allows a user to check for integrity. 
Supports comparing tables across different services.
For example, you can compare a table in Snowflake with a table in Redshift.

Supported connectors:
 - Snowflake
 - BigQuery
 - Athena
 - Redshift
 - Postgres
 - MySQL
 - MSSQL
 - Oracle
 - Trino
 - SAP Hana

**Dimension**:
Consistency

**Properties**

* `keyColumns`: The key column to use as the key for the comparison. Resolves to the primary key (if defined) if not set
* `useColumns`: The columns against which the comparison will done. If not provided it will use all the columns
* `table2`: The table against which the comparison will be done. Must be the fully qualified name as defined in OpenMetadata
* `threshold`: The threshold of different rows above which the test should fail -- default to 0
* `where`: Any `where` clause to pass 
* `caseSensitiveColumns`: Whether the column comparison should be case sensitive or not. Default to `false`.

**Behavior**

| Condition      | Status |
| ----------- | ----------- |
|Number of rows **is greater** than the threshold (default to 0) | Failed ❌|
|Number of rows **is less than or equal** to the threshold | Success ✅|

**YAML Config**

```yaml
name: myName
entityLink: '<#E::table::postgres_rds.TESTDB.snowflake_db_test.dim_data_columns>'
testDefinition: tableDiff
testSuite: postgres_rds.TESTDB.snowflake_db_test.dim_data_columns.testSuite
parameterValues:
  - name: keyColumns
    value: '["id"]'
  - name: useColumns
    value: '["name_column_name"]'
  - name: table2
    value: redshift_dbt.dev.dbt_jaffle.boolean_test
  - name: threshold
    value: 10
  - name: where
    value: id != 999
  - name: caseSensitiveColumns
    value: false
```

**JSON Config**

```json
{
  "name": "myName",
  "entityLink": "<#E::table::postgres_rds.TESTDB.snowflake_db_test.dim_data_columns>",
  "testDefinition": "tableDiff",
  "testSuite": "postgres_rds.TESTDB.snowflake_db_test.dim_data_columns.testSuite",
  "parameterValues": [
    {
      "name": "keyColumns",
      "value": "[\"id\"]"
    },
    {
      "name": "useColumns",
      "value": "[\"name_column_name\"]"
    },
    {
      "name": "table2",
      "value": "redshift_dbt.dev.dbt_jaffle.boolean_test"
    },
    {
      "name": "threshold",
      "value": 10
    },
    {
      "name": "where",
      "value": "id != 999"
    },
    {
      "name": "caseSensitiveColumns",
      "value": false
    }
  ]
}
```

### Table Data to Be Fresh [Collate]
Validate the freshness of a table's data. 

**Dimension**:
Accuracy

**Properties**

* `column`: the colummn that will be used to chech the table freshness
* `timeSinceUpdate`: (in seconds) The data is expected to be updated within this number of seconds. If the time since the last update is greater than this value, the test will fail.

**Behavior**

| Condition      | Status |
| ----------- | ----------- |
|Time since update is greater than **timeSinceUpdate** | Failed ❌|
|Time since update is less than or equal to **timeSinceUpdate** | Success ✅|

**YAML Config**

```yaml
name: myName
entityLink: '<#E::table::postgres_rds.TESTDB.snowflake_db_test.dim_data_columns>'
testDefinition: tableDataToBeFresh
testSuite: postgres_rds.TESTDB.snowflake_db_test.dim_data_columns.testSuite
parameterValues:
  - name: column
    value: id
  - name: timeSinceUpdate
    value: 30
```

**JSON Config**

```json
{
  "name": "myName",
  "displayName": "dim_data_columns_table_data_to_be_fresh_NeUs",
  "entityLink": "<#E::table::postgres_rds.TESTDB.snowflake_db_test.dim_data_columns>",
  "testDefinition": "tableDataToBeFresh",
  "testSuite": "postgres_rds.TESTDB.snowflake_db_test.dim_data_columns.testSuite",
  "parameterValues": [
    {
      "name": "column",
      "value": "id"
    },
    {
      "name": "timeSinceUpdate",
      "value": 30
    }
  ]
}
```

## Column Tests
Tests applied on top of Column metrics. Here is the list of all column tests:
- [Column Values to Be Unique](#column-values-to-be-unique)
- [Column Values to Be Not Null](#column-values-to-be-not-null)
- [Column Values to Match Regex](#column-values-to-match-regex)
- [Column Values to not Match Regex](#column-values-to-not-match-regex)
- [Column Values to Be in Set](#column-values-to-be-in-set)
- [Column Values to Be Not In Set](#column-values-to-be-not-in-set)
- [Column Values to Be Between](#column-values-to-be-between)
- [Column Values Missing Count to Be Equal](#column-values-missing-count-to-be-equal)
- [Column Values Lengths to Be Between](#column-values-lengths-to-be-between)
- [Column Value Max to Be Between](#column-value-max-to-be-between)
- [Column Value Min to Be Between](#column-value-min-to-be-between)
- [Column Value Mean to Be Between](#column-value-mean-to-be-between)
- [Column Value Median to Be Between](#column-value-median-to-be-between)
- [Column Values Sum to Be Between](#column-values-sum-to-be-between)
- [Column Values Standard Deviation to Be Between](#column-values-standard-deviation-to-be-between)
- [Column Values To Be At Expected Location](#column-values-to-be-at-expected-location)

### Column Values to Be Unique
Makes sure that there are no duplicate values in a given column.

**Dimension**:
Uniqueness

**Behavior**

| Condition      | Status |
| ----------- | ----------- |
|column values are unique|Success ✅|
|column values are not unique|Failed ❌|

**Properties**

* `columnValuesToBeUnique`: To be set as `true`. This is required for proper JSON parsing in the profiler module.

**YAML Config**

```yaml
- name: myTestName
  description: test description
  columnName: columnName
  testDefinitionName: columnValuesToBeUnique
  computePassedFailedRowCount: <true or false>
  parameterValues:
    - name: columnNames
      value: true
```

**JSON Config**

```json
{
    "name": "myTestName",
    "description": "test description",
    "columnName": "columnName",
    "testDefinitionName": "columnValuesToBeUnique",
    "parameterValues": [
        {
            "name": "columnNames",
            "value": true
        }
    ]
}
```

### Column Values to Be Not Null
Validates that there are no null values in the column.

**Dimension**:
Completeness

**Properties**

* `columnValuesToBeNotNull`: To be set as `true`. This is required for proper JSON parsing in the profiler module.

**Behavior**

| Condition      | Status |
| ----------- | ----------- |
|No `NULL` values are present in the column|Success ✅|
|1 or more `NULL` values are present in the column|Failed ❌|

**YAML Config**

```yaml
- name: myTestName
  description: test description
  columnName: columnName
  testDefinitionName: columnValuesToBeNotNull
  computePassedFailedRowCount: <true or false>
  parameterValues:
    - name: columnValuesToBeNotNull
      value: true
```

**JSON Config**

```json
{
    "name": "myTestName",
    "description": "test description",
    "columnName": "columnName",
    "testDefinitionName": "columnValuesToBeNotNull",
    "parameterValues": [
        {
            "name": "columnValuesToBeNotNull",
            "value": true
        }
    ]
}
```

### Column Values to Match Regex
This test allows us to specify how many values in a column we expect that will match a certain regex expression. Please note that for certain databases we will fall back to SQL `LIKE` expression. The databases supporting regex pattern as of 0.13.2 are:
- redshift
- postgres
- oracle
- mysql
- mariaDB
- sqlite
- clickhouse
- snowflake

The other databases will fall back to the `LIKE` expression

**Dimension**:
Validity

**Properties**

* `regex`: expression to match a regex pattern. E.g., `[a-zA-Z0-9]{5}`.

**Behavior**

| Condition      | Status |
| ----------- | ----------- |
|All column values match `regex`|Success ✅|
|1 or more column values do not match `regex`|Failed ❌|

**YAML Config**

```yaml
- name: myTestName
  description: test description
  columnName: columnName
  testDefinitionName: columnValuesToMatchRegex
  computePassedFailedRowCount: <true or false>
  parameterValues:
    - name: regex
      value: "%something%"
```

**JSON Config**

```json
{
    "name": "myTestName",
    "description": "test description",
    "columnName": "columnName",
    "testDefinitionName": "columnValuesToMatchRegex",
    "parameterValues": [
        {
            "name": "regex",
            "value": "%something%"
        }
    ]
}
```

### Column Values to not Match Regex
This test allows us to specify values in a column we expect that will not match a certain regex expression. If the test find values matching the `forbiddenRegex` the test will fail. Please note that for certain databases we will fall back to SQL `LIKE` expression. The databases supporting regex pattern as of 0.13.2 are:
- redshift
- postgres
- oracle
- mysql
- mariaDB
- sqlite
- clickhouse
- snowflake

The other databases will fall back to the `LIKE` expression

**Dimension**:
Validity

**Properties**

* `regex`: expression to match a regex pattern. E.g., `[a-zA-Z0-9]{5}`.

**Behavior**

| Condition      | Status |
| ----------- | ----------- |
|0 column value match `regex`|Success ✅|
|1 or more column values match `regex`|Failed ❌|

**YAML Config**

```yaml
- name: myTestName
  description: test description
  columnName: columnName
  testDefinitionName: columnValuesToMatchRegex
  computePassedFailedRowCount: <true or false>
  parameterValues:
    - name: forbiddenRegex
      value: "%something%"
```

**JSON Config**

```json
{
    "name": "myTestName",
    "description": "test description",
    "columnName": "columnName",
    "testDefinitionName": "columnValuesToMatchRegex",
    "parameterValues": [
        {
            "name": "forbiddenRegex",
            "value": "%something%"
        }
    ]
}
```

### Column Values to Be in Set
Validate values form a set are present in a column.

**Dimension**:
Validity

**Properties**

* `allowedValues`: List of allowed strings or numbers.

**Behavior**

| Condition                                                                                | Status    |
|------------------------------------------------------------------------------------------|-----------|
| `matchEnum` is `false` and 1 or more values from `allowedValues` is found in the column  | Success ✅ |
| `matchEnum` is `true` and all columns have a value from `allowedValues`                  | Success ✅ |
| `matchEnum` is `false` 0 value from `allowedValues` is found in the column               | Failed ❌  |
| `matchEnum` is `true` and 1 or more columns does not have a vluae from `allowedValues`   | Failed ❌  |

**YAML Config**

```yaml
- name: myTestName
  testDefinitionName: columnValuesToBeInSet
  columnName: columnName
  computePassedFailedRowCount: <true or false>
  parameterValues:
    - name: allowedValues
      value: '["forbidden1", "forbidden2"]'
    - name: matchEnum
      value: ""  # or true  
```

**JSON Config**

```json
{
    "name": "myTestName",
    "description": "test description",
    "columnName": "columnName",
    "testDefinitionName": "columnValuesToBeInSet",
    "parameterValues": [
        {
            "name": "allowedValues",
            "value": [
                "forbidden1",
                "forbidden2"
            ]
        },
        {
            "name": "matchEnum",
            "value": "" 
        }
    ]
}
```

**JSON Config**

```json
{
    "name": "myTestName",
    "description": "test description",
    "columnName": "columnName",
    "testDefinitionName": "columnValuesToBeInSet",
    "parameterValues": [
        {
            "name": "allowedValues",
            "value": [
                "forbidden1",
                "forbidden2"
            ]
        }
    ]
}
```

### Column Values to Be Not In Set
Validate that there are no values in a column in a set of forbidden values.

**Dimension**:
Validity

**Properties**

* `forbiddenValues`: List of forbidden strings or numbers.

**Behavior**

| Condition      | Status |
| ----------- | ----------- |
|0 value from `forbiddenValues` is found in the column|Success ✅|
|1 or more values from `forbiddenValues` is found in the column|Failed ❌|

**YAML Config**

```yaml
- name: myTestName
  description: test description
  columnName: columnName
  testDefinitionName: columnValuesToBeNotInSet
  computePassedFailedRowCount: <true or false>
  parameterValues:
    - name: forbiddenValues
      value: ["forbidden1", "forbidden2"]
```

**JSON Config**

```json
{
    "name": "myTestName",
    "description": "test description",
    "columnName": "columnName",
    "testDefinitionName": "columnValuesToBeNotInSet",
    "parameterValues": [
        {
            "name": "forbiddenValues",
            "value": [
                "forbidden1",
                "forbidden2"
            ]
        }
    ]
}
```

### Column Values to Be Between
Validate that the values of a column are within a given range.
> Only supports numerical types.

**Dimension**:
Accuracy

**Properties**

* `minValue`: Lower bound of the interval. If informed, the column values should be bigger than this number.
* `maxValue`: Upper bound of the interval. If informed, the column values should be lower than this number.

Any of those two need to be informed.

**Behavior**

| Condition      | Status |
| ----------- | ----------- |
|value is **between** `minValue` and `maxValue`|Success ✅|
|value is **greater** than `minValue` if only `minValue` is specified|Success ✅|
|value is **less** then `maxValue` if only `maxValue` is specified|Success ✅|
|value is **not between** `minValue` and `maxValue`|Failed ❌|
|value is **less** than `minValue` if only `minValue` is specified|Failed ❌|
|value is **greater** then `maxValue` if only `maxValue` is specified|Failed ❌|

**YAML Config**

```yaml
- name: myTestName
  description: test description
  columnName: columnName
  testDefinitionName: columnValuesToBeBetween
  computePassedFailedRowCount: <true or false>
  parameterValues:
    - name: minValue
      value: ["forbidden1", "forbidden2"]
```

**JSON Config**

```json
{
    "name": "myTestName",
    "description": "test description",
    "columnName": "columnName",
    "testDefinitionName": "columnValuesToBeBetween",
    "parameterValues": [
        {
            "name": "minValue",
            "value": [
                "forbidden1",
                "forbidden2"
            ]
        }
    ]
}
```

### Column Values Missing Count to Be Equal
Validates that the number of missing values matches a given number. Missing values are the sum of nulls, plus the sum of values in a given list which we need to consider as missing data. A clear example of that would be `NA` or `N/A`.

**Dimension**:
Completeness

**Properties**

* `missingCountValue`: The number of missing values needs to be equal to this. This field is mandatory.
* `missingValueMatch` (Optional): A list of strings to consider as missing values.

**Behavior**

| Condition      | Status |
| ----------- | ----------- |
|Number of missing value is **equal** to `missingCountValue`|Success ✅|
|Number of missing value is **not equal** to `missingCountValue`|Failed ❌|

**YAML Config**

```yaml
- name: myTestName
  description: test description
  columnName: columnName
  testDefinitionName: columnValuesMissingCountToBeEqual
  parameterValues:
    - name: missingValueMatch
      value: ["NA", "N/A"]
    - name: missingCountValue
      value: 100
```

**JSON Config**

```json
{
    "name": "myTestName",
    "description": "test description",
    "columnName": "columnName",
    "testDefinitionName": "columnValuesMissingCountToBeEqual",
    "parameterValues": [
        {
            "name": "missingValueMatch",
            "value": [
                "NA",
                "N/A"
            ]
        },
        {
            "name": "missingCountValue",
            "value": 100
        }
    ]
}
```

**JSON Config**

```json
{
    "name": "myTestName",
    "description": "test description",
    "columnName": "columnName",
    "testDefinitionName": "columnValuesMissingCountToBeEqual",
    "parameterValues": [
        {
            "name": "missingValueMatch",
            "value": [
                "NA",
                "N/A"
            ]
        },
        {
            "name": "missingCountValue",
            "value": 100
        }
    ]
}
```

### Column Values Lengths to Be Between
Validates that the lengths of the strings in a column are within a given range.
> Only supports concatenable types.

**Dimension**:
Accuracy

**Properties**

* `minLength`: Lower bound of the interval. If informed, the string length should be bigger than this number.
* `maxLength`: Upper bound of the interval. If informed, the string length should be lower than this number.

Any of those two need to be informed.

**Behavior**

| Condition      | Status |
| ----------- | ----------- |
|value length is **between** `minLength` and `maxLength`|Success ✅|
|value length is **greater** than `minLength` if only `minLength` is specified|Success ✅|
|value length is **less** then `maxLength` if only `maxLength` is specified|Success ✅|
|value length is **not between** `minLength` and `maxLength`|Failed ❌|
|value length is **less** than `minLength` if only `minLength` is specified|Failed ❌|
|value length is **greater** then `maxLength` if only `maxLength` is specified|Failed ❌|

**YAML Config**

```yaml
- name: myTestName
  description: test description
  columnName: columnName
  testDefinitionName: columnValueLengthsToBeBetween
  computePassedFailedRowCount: <true or false>
  parameterValues:
    - name: minLength
      value: 50
    - name: maxLength
      value: 100
```

**JSON Config**

```json
{
    "name": "myTestName",
    "description": "test description",
    "columnName": "columnName",
    "testDefinitionName": "columnValueLengthsToBeBetween",
    "parameterValues": [
        {
            "name": "minLength",
            "value": 50
        },
        {
            "name": "maxLength",
            "value": 100
        }
    ]
}
```

### Column Value Max to Be Between
Validate the maximum value of a column is between a specific range
> Only supports numerical types.

**Dimension**:
Accuracy

**Properties**

* `minValueForMaxInCol`: lower bound
* `maxValueForMaxInCol`: upper bound

**Behavior**

| Condition      | Status |
| ----------- | ----------- |
|column max value is **between** `minValueForMaxInCol` and `maxValueForMaxInCol`|Success ✅|
|column max value is **greater** than `minValueForMaxInCol` if only `minValueForMaxInCol` is specified|Success ✅|
|column max value is **less** then `maxValueForMaxInCol` if only `maxValueForMaxInCol` is specified|Success ✅|
|column max value is **not between** `minValueForMaxInCol` and `maxValueForMaxInCol`|Failed ❌|
|column max value is **less** than `minValueForMaxInCol` if only `minValueForMaxInCol` is specified|Failed ❌|
|column max value is **greater** then `maxValueForMaxInCol` if only `maxValueForMaxInCol` is specified|Failed ❌|

**YAML Config**

```yaml
- name: myTestName
  description: test description
  columnName: columnName
  testDefinitionName: columnValueMaxToBeBetween
  parameterValues:
    - name: minValueForMaxInCol
      value: 50
    - name: maxValueForMaxInCol
      value: 100
```

**JSON Config**

```json
{
    "name": "myTestName",
    "description": "test description",
    "columnName": "columnName",
    "testDefinitionName": "columnValueMaxToBeBetween",
    "parameterValues": [
        {
            "name": "minValueForMaxInCol",
            "value": 50
        },
        {
            "name": "maxValueForMaxInCol",
            "value": 100
        }
    ]
}
```

### Column Value Min to Be Between
Validate the minimum value of a column is between a specific range
> Only supports numerical types.

**Dimension**:
Accuracy

**Properties**

* `minValueForMinInCol`: lower bound
* `maxValueForMinInCol`: upper bound

**Behavior**

| Condition      | Status |
| ----------- | ----------- |
|column min value is **between** `minValueForMinInCol` and `maxValueForMinInCol`|Success ✅|
|column min value is **greater** than `minValueForMinInCol` if only `minValueForMinInCol` is specified|Success ✅|
|column min value is **less** then `maxValueForMinInCol` if only `maxValueForMinInCol` is specified|Success ✅|
|column min value is **not between** `minValueForMinInCol` and `maxValueForMinInCol`|Failed ❌|
|column min value is **less** than `minValueForMinInCol` if only `minValueForMinInCol` is specified|Failed ❌|
|column min value is **greater** then `maxValueForMinInCol` if only `maxValueForMinInCol` is specified|Failed ❌|

**YAML Config**

```yaml
- name: myTestName
  description: test description
  columnName: columnName
  testDefinitionName: columnValueMinToBeBetween
  parameterValues:
    - name: minValueForMinInCol
      value: 10
    - name: maxValueForMinInCol
      value: 50
```

**JSON Config**

```json
{   
    "name": "myTestName",
    "description": "test description",
    "columnName": "columnName",
    "testDefinitionName": "columnValueMinToBeBetween",
    "parameterValues": [
        {
            "name": "minValueForMinInCol",
            "value": 10
        },
        {
            "name": "maxValueForMinInCol",
            "value": 50
        }
    ]
}
```

### Column Value Mean to Be Between
Validate the mean of a column is between a specific range
> Only supports numerical types.

**Dimension**:
Accuracy

**Properties**

* `minValueForMeanInCol`: lower bound
* `maxValueForMeanInCol`: upper bound

**Behavior**

| Condition      | Status |
| ----------- | ----------- |
|column mean value is **between** `minValueForMeanInCol` and `maxValueForMeanInCol`|Success ✅|
|column mean value is **greater** than `minValueForMeanInCol` if only `minValueForMeanInCol` is specified|Success ✅|
|column mean value is **less** then `maxValueForMeanInCol` if only `maxValueForMeanInCol` is specified|Success ✅|
|column mean value is **not between** `minValueForMeanInCol` and `maxValueForMeanInCol`|Failed ❌|
|column mean value is **less** than `minValueForMeanInCol` if only `minValueForMeanInCol` is specified|Failed ❌|
|column mean value is **greater** then `maxValueForMeanInCol` if only `maxValueForMeanInCol` is specified|Failed ❌|

**YAML Config**

```yaml
- name: myTestName
  description: test description
  columnName: columnName
  testDefinitionName: columnValueMeanToBeBetween
  parameterValues:
    - name: minValueForMeanInCol
      value: 5
    - name: maxValueForMeanInCol
      value: 10
```

**JSON Config**

```json
{
    "name": "myTestName",
    "description": "test description",
    "columnName": "columnName",
    "testDefinitionName": "columnValueMeanToBeBetween",
    "parameterValues": [
        {
            "name": "minValueForMeanInCol",
            "value": 5
        },
        {
            "name": "maxValueForMeanInCol",
            "value": 10
        }
    ]
}
```

### Column Value Median to Be Between
Validate the median of a column is between a specific range
> Only supports numerical types.

**Dimension**:
Accuracy

**Properties**

* `minValueForMedianInCol`: lower bound
* `maxValueForMedianInCol`: upper bound

**Behavior**

| Condition      | Status |
| ----------- | ----------- |
|column median value is **between** `minValueForMedianInCol` and `maxValueForMedianInCol`|Success ✅|
|column median value is **greater** than `minValueForMedianInCol` if only `minValueForMedianInCol` is specified|Success ✅|
|column median value is **less** then `maxValueForMedianInCol` if only `maxValueForMedianInCol` is specified|Success ✅|
|column median value is **not between** `minValueForMedianInCol` and `maxValueForMedianInCol`|Failed ❌|
|column median value is **less** than `minValueForMedianInCol` if only `minValueForMedianInCol` is specified|Failed ❌|
|column median value is **greater** then `maxValueForMedianInCol` if only `maxValueForMedianInCol` is specified|Failed ❌|

**YAML Config**

```yaml
- name: myTestName
  description: test description
  columnName: columnName
  testDefinitionName: columnValueMedianToBeBetween
  parameterValues:
    - name: minValueForMedianInCol
      value: 5
    - name: maxValueForMedianInCol
      value: 10
```

**JSON Config**

```json
{
    "name": "myTestName",
    "description": "test description",
    "columnName": "columnName",
    "testDefinitionName": "columnValueMedianToBeBetween",
    "parameterValues": [
        {
            "name": "minValueForMedianInCol",
            "value": 5
        },
        {
            "name": "maxValueForMedianInCol",
            "value": 10
        }
    ]
}
```

### Column Values Sum to Be Between
Validate the sum of a column is between a specific range
> Only supports numerical types.

**Dimension**:
Accuracy

**Properties**

* `minValueForColSum`: lower bound
* `maxValueForColSum`: upper bound

**Behavior**

| Condition      | Status |
| ----------- | ----------- |
|Sum of the column values is **between** `minValueForColSum` and `maxValueForColSum`|Success ✅|
|Sum of the column values is **greater** than `minValueForColSum` if only `minValueForColSum` is specified|Success ✅|
|Sum of the column values is **less** then `maxValueForColSum` if only `maxValueForColSum` is specified|Success ✅|
|Sum of the column values is **not between** `minValueForColSum` and `maxValueForColSum`|Failed ❌|
|Sum of the column values is **less** than `minValueForColSum` if only `minValueForColSum` is specified|Failed ❌|
|Sum of the column values is **greater** then `maxValueForColSum` if only `maxValueForColSum` is specified|Failed ❌|

**YAML Config**

```yaml
- name: myTestName
  description: test description
  columnName: columnName
  testDefinitionName: columnValueMedianToBeBetween
  parameterValues:
    - name: minValueForMedianInCol
      value: 5
    - name: maxValueForMedianInCol
      value: 10
```

**JSON Config**

```json
{
    "name": "myTestName",
    "description": "test description",
    "columnName": "columnName",
    "testDefinitionName": "columnValueMedianToBeBetween",
    "parameterValues": [
        {
            "name": "minValueForMedianInCol",
            "value": 5
        },
        {
            "name": "maxValueForMedianInCol",
            "value": 10
        }
    ]
}
```

### Column Values Standard Deviation to Be Between
Validate the standard deviation of a column is between a specific range
> Only supports numerical types.

**Dimension**:
Accuracy

**Properties**

* `minValueForStdDevInCol`: lower bound
* `minValueForStdDevInCol`: upper bound

**Behavior**

| Condition      | Status |
| ----------- | ----------- |
|column values standard deviation is **between** `minValueForStdDevInCol` and `minValueForStdDevInCol`|Success ✅|
|column values standard deviation is **greater** than `minValueForStdDevInCol` if only `minValueForStdDevInCol` is specified|Success ✅|
|column values standard deviation is **less** then `minValueForStdDevInCol` if only `minValueForStdDevInCol` is specified|Success ✅|
|column values standard deviation is **not between** `minValueForStdDevInCol` and `minValueForStdDevInCol`|Failed ❌|
|column values standard deviation is **less** than `minValueForStdDevInCol` if only `minValueForStdDevInCol` is specified|Failed ❌|
|column values standard deviation is **greater** then `minValueForStdDevInCol` if only `minValueForStdDevInCol` is specified|Failed ❌|

**YAML Config**

```yaml
- name: myTestName
  description: test description
  columnName: columnName
  testDefinitionName: columnValueStdDevToBeBetween
  parameterValues:
    - name: minValueForStdDevInCol
      value: 5
    - name: maxValueForStdDevInCol
      value: 10
```

**JSON Config**

```json
{
    "name": "myTestName",
    "description": "test description",
    "columnName": "columnName",
    "testDefinitionName": "columnValueStdDevToBeBetween",
    "parameterValues": [
        {
            "name": "minValueForStdDevInCol",
            "value": 5
        },
        {
            "name": "maxValueForStdDevInCol",
            "value": 10
        }
    ]
}
```

### Column Values To Be At Expected Location
Validate the reference value for a column is a the expected geographic location
> Data will be temporarely stored in memory while the test case is running to validate the location. Not data will be permanently stored.
> France is the only supported location at this time. To add any additional location please reach out to the team in our slack support channel

**Dimension**:
Accuracy

**Properties**

* `locationReferenceType`: the type of location refernce `CITY` or `POSTAL_CODE`
* `longitudeColumnName`: longitude column name
* `latitudeColumnName`: latitude column name
* `radius`: radius in meter from which the location can be from the expected lat/long -- acts as a buffer

**Behavior**

| Condition      | Status |
| ----------- | ----------- |
|column values lat/long is **within** the polygon of the column reference (+/- radius) |Success ✅|
|column values lat/long is **outside** the polygon of the column reference (+/- radius)|Failed ❌|

**YAML Config**

```yaml
- name: ExpectedGeoLocation
  testDefinitionName: ColumnValuesToBeAtExpectedLocation
  columnName: "Code Insee"
  parameterValues:
    - name: locationReferenceType
      value: POSTAL_CODE
    - name: longitudeColumnName
      value: "Coordonnée Y"
    - name: latitudeColumnName
      value: "Coordonnée X"
    - name: radius
      value: "1000"
```

**JSON Config**

```json
  {
    "name": "ExpectedGeoLocation",
    "testDefinitionName": "ColumnValuesToBeAtExpectedLocation",
    "columnName": "Code Insee",
    "parameterValues": [
      {
        "name": "locationReferenceType",
        "value": "POSTAL_CODE"
      },
      {
        "name": "longitudeColumnName",
        "value": "Coordonnée Y"
      },
      {
        "name": "latitudeColumnName",
        "value": "Coordonnée X"
      },
      {
        "name": "radius",
        "value": "1000"
      }
    ]
  }
```
