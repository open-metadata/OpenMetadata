# OpenMetadata Test Definitions Coverage

## Complete Test Suite for All 25 Test Definitions

Your Playwright test suite now covers **ALL 25** test definitions available in OpenMetadata! 

### Original Coverage (3 tests):
1. `tableDiff` - Table difference test case
2. `tableCustomSQLQuery` - Custom SQL Query
3. `columnValuesToBeNotNull` - Column Values To Be Not Null

### Newly Added Coverage (22 tests):

#### Statistical Column Tests (8):
4. `columnValuesToBeUnique` - Column Values To Be Unique
5. `columnValuesToBeBetween` - Column Values To Be Between
6. `columnValueMaxToBeBetween` - Column Value Max To Be Between
7. `columnValueMeanToBeBetween` - Column Value Mean To Be Between
8. `columnValueMinToBeBetween` - Column Value Min To Be Between
9. `columnValueStdDevToBeBetween` - Column Value Std Dev To Be Between
10. `columnValueMedianToBeBetween` - Column Value Median To Be Between
11. `columnValuesSumToBeBetween` - Column Values Sum To Be Between

#### String/Pattern Column Tests (4):
12. `columnValuesToMatchRegex` - Column Values To Match Regex
13. `columnValuesToNotMatchRegex` - Column Values To Not Match Regex
14. `columnValuesLengthsToBeBetween` - Column Values Lengths To Be Between
15. `columnValuesToBeInSet` - Column Values To Be In Set
16. `columnValuesToBeNotInSet` - Column Values To Be Not In Set

#### Specialized Column Tests (2):
17. `columnValuesMissingCountToBeEqual` - Column Values Missing Count To Be Equal
18. `columnValuesToBeAtExpectedLocation` - Column Values To Be At Expected Location

#### Table Tests (7):
19. `tableRowCountToBeBetween` - Table Row Count To Be Between
20. `tableColumnCountToEqual` - Table Column Count To Equal
21. `tableRowCountToEqual` - Table Row Count To Equal
22. `tableColumnToMatchSet` - Table Column To Match Set
23. `tableRowInsertedCountToBeBetween` - Table Row Inserted Count To Be Between
24. `tableColumnCountToBeBetween` - Table Column Count To Be Between
25. `tableColumnNameToExist` - Table Column Name To Exist

## Test Coverage by Data Quality Dimensions:

### Accuracy (6):
- columnValuesToBeBetween
- columnValueMaxToBeBetween
- columnValueMeanToBeBetween
- columnValueMinToBeBetween
- columnValueStdDevToBeBetween
- columnValueMedianToBeBetween
- columnValuesSumToBeBetween
- columnValuesLengthsToBeBetween
- columnValuesToBeAtExpectedLocation

### Completeness (2):
- columnValuesToBeNotNull
- columnValuesMissingCountToBeEqual

### Consistency (1):
- tableDiff

### Uniqueness (1):
- columnValuesToBeUnique

### Validity (4):
- columnValuesToMatchRegex
- columnValuesToNotMatchRegex
- columnValuesToBeInSet
- columnValuesToBeNotInSet

### Integrity (8):
- tableRowCountToBeBetween
- tableColumnCountToEqual
- tableRowCountToEqual
- tableColumnToMatchSet
- tableRowInsertedCountToBeBetween
- tableColumnCountToBeBetween
- tableColumnNameToExist
- tableCustomSQLQuery

## Parameter Patterns Covered:

### Range Parameters:
- `minValue` / `maxValue`
- `minValueForMaxInCol` / `maxValueForMaxInCol`
- `minValueForMeanInCol` / `maxValueForMeanInCol`
- `minValueForMinInCol` / `maxValueForMinInCol`
- `minValueForStdDevInCol` / `maxValueForStdDevInCol`
- `minValueForMedianInCol` / `maxValueForMedianInCol`
- `minValueForSumInCol` / `maxValueForSumInCol`
- `minLength` / `maxLength`

### String Parameters:
- `regex` (pattern matching)
- `columnName` (single column reference)
- `columnNames` (comma-separated list)
- `missingValueMatch` (missing value pattern)

### Array Parameters:
- `allowedValues` (whitelist)
- `forbiddenValues` (blacklist)
- `locationReferenceType` (enum selection)

### Numeric Parameters:
- `value` (exact count)
- `columnCount` (exact column count)
- `missingCountValue` (exact missing count)
- `radius` (geographic radius in meters)
- `rangeInterval` (time interval)

### Boolean Parameters:
- `ordered` (order significance)
- `matchEnum` (enum matching mode)

### Complex Parameters:
- `longitudeColumnName` / `latitudeColumnName` (geographic coordinates)
- `rangeType` (time range type: HOUR, DAY, MONTH, YEAR)

## Features Tested for Each Test Case:

### 1. Create Functionality:
- Form field population
- Parameter validation
- Test case creation via API
- Success notification verification

### 2. Edit Functionality:
- Modal opening and validation
- Field updates
- Parameter modifications
- Update confirmation

### 3. Delete Functionality:
- Test case deletion
- Cleanup verification

### 4. Error Handling:
- Proper cleanup in finally blocks
- API response waiting
- Network idle states

## Total Coverage: **25/25 (100%)**

All OpenMetadata test definitions are now comprehensively covered with full create/edit/delete test scenarios!