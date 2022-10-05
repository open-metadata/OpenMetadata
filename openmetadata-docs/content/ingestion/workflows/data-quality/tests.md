---
title: Tests
slug: /openmetadata/ingestion/workflows/data-quality/tests
---

# Test
Here you can see all the supported tests definitions and how to configure them in the YAML config file.

A **Test Definition** is a generic definition of a test. This Test Definition then gets specified in a Test Case. This Test Case is where the parameter(s) of a Test Definition are specified.

In this section, you will learn what tests we currently support and how to configure them in the YAML/JSON config file.

## Table Tests
Tests applied on top of a Table. Here is the list of all table tests:

- [Table Row Count to Equal](#table-row-count-to-equal)
- [Table Row Count to be Between](#table-row-count-to-be-between)
- [Table Column Count to Equal](#table-column-count-to-equal)
- [Table Column Count to be Between](#table-column-count-to-be-between)
- [Table Column Name to Exist](#table-column-name-to-exist)
- [Table Column to Match Set](#table-column-to-match-set)
- [Table Custom SQL Test](#table-custom-sql-test)

### Table Row Count to Equal
Validate the total row count in the table is equal to the given value.

**Properties**:

* `value`: Expected number of rows.

**YAML Config**

```yaml
testDefinitionName: tableRowCountToEqual
parameterValues:
    - name: value
      value: 2
```

**JSON Config**

```json
{
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

**Properties**:

* `minValue`: Lower bound of the interval. If informed, the number of rows should be bigger than this number.
* `maxValue`: Upper bound of the interval. If informed, the number of rows should be lower than this number.

Any of those two need to be informed.

**YAML Config**

```yaml
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

**Properties**

* `columnCount`: Expected number of columns.

**YAML Config**

```yaml
testDefinitionName: tableColumnCountToEqual
parameterValues:
    - name: columnCount
      value: 5
```

**JSON Config**

```json
{
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

**Properties**

* `minColValue`: lower bound
* `maxColValue`: upper bound

**YAML Config**

```yaml
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

**Properties**

* `columnName`: the name of the column to check for

**YAML Config**

```yaml
testDefinitionName: tableColumnNameToExist
parameterValues:
    - name: columnName
      value: order_id
```

**JSON Config**

```json
{
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

**Properties**

* `columnNames`: comma separated string of column name
* `ordered`: whether the test should check for column ordering. Default to False

**YAML Config**

```yaml
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
Write you own SQL test. The test will pass if either of the following condition is met:
- The query result return 0 row
- The query expression `COUNT(<col>)` returns 0

**Properties**

* `sqlExpression`: SQL expression

**Example**
```sql
SELECT 
COUNT(customer_tier)
FROM DUAL 
WHERE customer_tier = 'GOLD' and lifetime_value < 10000;
```

```sql
SELECT 
customer_id
FROM DUAL 
WHERE lifetime_value < 0;
```

**YAML Config**

```yaml
testDefinitionName: tableCustomSQLQuery
parameterValues:
    - name: sqlExpression
      value: >
        SELECT 
        COUNT(customer_tier)
        FROM DUAL 
        WHERE customer_tier = 'GOLD' and lifetime_value < 10000;
```

**JSON Config**

```json
{
    "testDefinitionName": "tableCustomSQLQuery",
    "parameterValues": [
        {
            "name": "sqlExpression",
            "value": "SELECT  COUNT(customer_tier) FROM DUAL  WHERE customer_tier = 'GOLD' and lifetime_value < 10000;\n"
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

### Column Values to Be Unique
Makes sure that there are no duplicate values in a given column.

**Properties**

* `columnValuesToBeUnique`: To be set as `true`. This is required for proper JSON parsing in the profiler module.

**YAML Config**

```yaml
testDefinitionName: columnValuesToBeUnique
parameterValues:
    - name: columnNames
      value: true
```

**JSON Config**

```json
{
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

**Properties**

* `columnValuesToBeNotNull`: To be set as `true`. This is required for proper JSON parsing in the profiler module.

**YAML Config**

```yaml
testDefinitionName: columnValuesToBeNotNull
parameterValues:
    - name: columnValuesToBeNotNull
      value: true
```

**JSON Config**

```json
{
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
This test allows us to specify how many values in a column we expect that will match a certain SQL `LIKE` expression.

**Properties**

* `regex`: SQL `LIKE` expression to match. E.g., `%something%`.

**YAML Config**

```yaml
testDefinitionName: columnValuesToMatchRegex
parameterValues:
    - name: regex
      value: "%something%"
```

**JSON Config**

```json
{
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
This test allows us to specify values in a column we expect that will not match a certain SQL `LIKE` expression. If the test find values matching the `forbiddenRegex` the test will fail.

**Properties**

* `forbiddenRegex`: SQL LIKE expression to match. E.g., `%something%`.

**YAML Config**

```yaml
testDefinitionName: columnValuesToMatchRegex
parameterValues:
    - name: forbiddenRegex
      value: "%something%"
```

**JSON Config**

```json
{
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

**Properties**

* `allowedValues`: List of allowed strings or numbers.

**YAML Config**

```yaml
testDefinitionName: columnValuesToBeInSet
parameterValues:
    - name: allowedValues
      value: ["forbidden1", "forbidden2"]
```

**JSON Config**

```json
{
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

**Properties**

* `forbiddenValues`: List of forbidden strings or numbers.

**YAML Config**

```yaml
testDefinitionName: columnValuesToBeNotInSet
parameterValues:
    - name: forbiddenValues
      value: ["forbidden1", "forbidden2"]
```

**JSON Config**

```json
{
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

**Properties**

* `minValue`: Lower bound of the interval. If informed, the column values should be bigger than this number.
* `maxValue`: Upper bound of the interval. If informed, the column values should be lower than this number.

Any of those two need to be informed.

**YAML Config**

```yaml
testDefinitionName: columnValuesToBeBetween
parameterValues:
    - name: minValue
      value: ["forbidden1", "forbidden2"]
```

**JSON Config**

```json
{
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

**Properties**

* `missingCountValue`: The number of missing values needs to be equal to this. This field is mandatory.
* `missingValueMatch`: A list of strings to consider as missing values. Optional.

**YAML Config**

```yaml
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

**Properties**

* `minLength`: Lower bound of the interval. If informed, the string length should be bigger than this number.
* `maxLength`: Upper bound of the interval. If informed, the string length should be lower than this number.

Any of those two need to be informed.

**YAML Config**

```yaml
testDefinitionName: columnValueLengthsToBeBetween
parameterValues:
    - name: minLength
      value: 50
    - name: maxLength
      value: 100
```

**JSON Config**

```json
{
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

**Properties**

* `minValueForMaxInCol`: lower bound
* `maxValueForMaxInCol`: upper bound

**YAML Config**

```yaml
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

**Properties**

* `minValueForMinInCol`: lower bound
* `maxValueForMinInCol`: upper bound

**YAML Config**

```yaml
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

**Properties**

* `minValueForMeanInCol`: lower bound
* `maxValueForMeanInCol`: upper bound

**YAML Config**

```yaml
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

**Properties**

* `minValueForMedianInCol`: lower bound
* `maxValueForMedianInCol`: upper bound

**YAML Config**

```yaml
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

**Properties**

* `minValueForColSum`: lower bound
* `maxValueForColSum`: upper bound

**YAML Config**

```yaml
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

**Properties**

* `minValueForStdDevInCol`: lower bound
* `minValueForStdDevInCol`: upper bound

**YAML Config**

```yaml
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
