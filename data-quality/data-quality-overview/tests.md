---
description: Here you can see all the supported tests and how to configure them.
---

# Tests

A **Test Case** adds logic to the Metrics results. A Metric is neither good nor wrong, so we need the Test definitions to map results into Success or Failures.

In this section, you will learn what tests we currently support and how to configure them.

## UI Configuration

You can navigate in the UI to a Table Entity and **Add Tests** from there. The form will help you select the type of test, the column, and its configurations.

From the **Data Quality** Tab you can create both Table and Column Tests:

![Write your first test](<../../docs/.gitbook/assets/image (4) (1) (1).png>)

![Sample form to create a column test](<../../docs/.gitbook/assets/image (16) (1) (1).png>)

Directly from the **Profiler** tab, you can create a Column Test in the column of your choice:

![Create a column test from the profiler tab](<../../docs/.gitbook/assets/image (16) (1).png>)

If you'd rather configure the tests directly in the Workflow JSON, we'll show examples for each of them below.

## Table Tests

Tests applied on top of Table Metrics.

### Table Row Count to Equal

Validate that the `rowCount` metric is equal to a given value.

#### Properties:

* `value`: Expected number of rows.

#### JSON Config

```
"testCase": {
    "config": {
        "value": 100
    },
    "tableTestType": "tableRowCountToEqual"
}
```

### Table Row Count to be Between

Validate that the `rowCount` metric is within a given range of values.

#### Properties:

* `minValue`: Lower bound of the interval. If informed, the number of rows should be bigger than this number.
* `maxValue`: Upper bound of the interval. If informed, the number of rows should be lower than this number.

Any of those two need to be informed.

#### JSON Config

```
"testCase": {
    "config": {
        "minValue": 10,
        "maxValue": 100
    },
    "tableTestType": "tableRowCountToBeBetween"
}
```

### Table Column Count to Equal

Validate that the number of columns in a table is equal to a given value.

#### Properties

* `columnCount`: Expected number of columns.

#### JSON Config

```
"testCase": {
    "config": {
        "columnCount": 7
    },
    "tableTestType": "tableColumnCountToEqual"
}
```

## Column Tests

Tests applied on top of Column metrics.

### Column Values to Be Unique

Makes sure that there are no duplicates in a given column.

#### Properties

* `columnValuesToBeUnique`: To be set as `true`. This is required for proper JSON parsing in the profiler module.

#### JSON Config

```
"testCase": {
    "config": {
        "columnValuesToBeUnique": true
    },
    "columnTestType": "columnValuesToBeUnique"
}
```

### Column Values to Be Not Null

Validates that there are no null values in the column.

#### Properties

* `columnValuesToBeNotNull`: To be set as `true`. This is required for proper JSON parsing in the profiler module.

#### JSON Config

```
"testCase": {
    "config": {
        "columnValuesToBeNotNull": true
    },
    "columnTestType": "columnValuesToBeNotNull"
}
```

### Column Values to Match Regex

This test allows us to specify how many values in a column we expect that will match a certain SQL `LIKE` expression.

#### Properties

* `regex`: SQL `LIKE` expression to match. E.g., `%something%`.

#### JSON Config

```
"testCase": {
    "config": {
        "regex": "%something%"
    },
    "columnTestType": "columnValuesToMatchRegex"
}
```

### Column Values to Be Not In Set

Validate that there are no values in a column in a set of forbidden values.

#### Properties

* `forbiddenValues`: List of forbidden strings or numbers.

#### JSON Config

```
"testCase": {
    "config": {
        "forbiddenValues": ["forbidden1", "forbidden2"]
    },
    "columnTestType": "columnValuesToBeNotInSet"
}
```

### Column Values to Be Between

Validate that the values of a column are within a given range.

> Only supports numerical types.

#### Properties

* `minValue`: Lower bound of the interval. If informed, the column values should be bigger than this number.
* `maxValue`: Upper bound of the interval. If informed, the column values should be lower than this number.

Any of those two need to be informed.

#### JSON Config

```
"testCase": {
    "config": {
        "minValue": 10,
        "maxValue": 100
    },
    "columnTestType": "columnValuesToBeBetween"
}
```

### Column Values Missing Count to Be Equal

Validates that the number of missing values matches a given number. Missing values are the sum of nulls, plus the sum of values in a given list which we need to consider as missing data. A clear example of that would be `NA` or `N/A`.

#### Properties

* `missingCountValue`: The number of missing values needs to be equal to this. This field is mandatory.
* `missingValueMatch`: A list of strings to consider as missing values. Optional.

#### JSON Config

```
"testCase": {
    "config": {
        "missingCountValue": 100,
        "missingValueMatch": ["NA", "N/A"]
    },
    "columnTestType": "columnValuesMissingCountToBeEqual"
}
```

### Column Values Lengths to Be Between

Validates that the lengths of the strings in a column are within a given range.

> Only supports concatenable types.

#### Properties

* `minLength`: Lower bound of the interval. If informed, the string length should be bigger than this number.
* `maxLength`: Upper bound of the interval. If informed, the string length should be lower than this number.

Any of those two need to be informed.

#### JSON Config

```
"testCase": {
    "config": {
        "minLength": 4,
        "maxLength": 18
    },
    "columnTestType": "columnValueLengthsToBeBetween"
}
```
