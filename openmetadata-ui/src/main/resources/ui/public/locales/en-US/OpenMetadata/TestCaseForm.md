# Data Quality

OpenMetadata supports comprehensive data quality testing to help ensure your data meets defined standards and expectations.

$$section
### Test Level $(id="testLevel")

Select the level at which you want to apply the test case. Choose between:
- **Table Level**: Tests that validate entire table properties such as row count, freshness, or custom SQL queries
- **Column Level**: Tests that validate specific column properties such as values, uniqueness, or data types
- **Dimension Level**: Tests that validate column properties segmented by one or more dimension columns, enabling granular quality analysis across different data segments

The test level determines which test types will be available for selection.
$$

$$section
### Table $(id="table")

Select the table on which you want to create the test case. You can search for tables by name or browse through the available options. The selected table will be the target for your data quality tests.

For column-level tests, you'll need to select a specific column after choosing the table.
$$

$$section
### Column $(id="column")

When creating column-level tests, select the specific column you want to test. The available columns are based on the selected table's schema. Column tests allow you to validate data at a granular level, checking for nulls, unique values, data formats, and more.
$$

$$section
### Dimension Columns $(id="dimensionColumns")

When creating dimension-level tests, select one or more columns that will serve as dimensions for grouping test results. Dimensions allow you to:
- **Analyze data quality across different segments**: Test results are computed separately for each unique combination of dimension values
- **Identify problematic subsets**: Pinpoint specific dimension values that are causing quality issues
- **Track quality trends**: Monitor how data quality varies across different categories, regions, time periods, or other dimensions
- **Enable granular monitoring**: Get detailed insights into which specific segments of your data are passing or failing quality checks

**Important Notes**:
- The selected column (the column being tested) cannot be used as a dimension
- Multiple dimension columns can be selected to create multi-dimensional analysis
- Dimension columns are typically categorical or low-cardinality columns (e.g., region, product_category, status)
- Each unique combination of dimension values will have its own test result

**Use Cases**:
- Testing sales amounts by region and product category
- Validating order counts by status and payment method
- Checking customer data quality segmented by country and account type
- Monitoring sensor readings grouped by location and device type

**Example**:
If you're testing the `amount` column with dimensions `region` and `product_type`, you'll see separate test results for each combination like:
- North America / Electronics
- North America / Clothing
- Europe / Electronics
- Europe / Clothing
$$

$$section
### Test Type $(id="testType")

Choose the type of test to apply based on your data quality requirements. Available test types depend on whether you selected table-level or column-level testing. Each test type has specific parameters and validation rules designed to check different aspects of data quality.

Common test types include:
- Value validation tests
- Uniqueness checks
- Null checks
- Pattern matching
- Range validations
- Custom SQL queries
$$

$$section
### Name $(id="name")

Provide a unique name for your test case. The name should be descriptive and follow these guidelines:
- Must start with a letter
- Can contain letters, numbers, and underscores
- Cannot contain spaces or special characters
- Maximum length of 256 characters
- Must be unique within the test suite

If left empty, a name will be automatically generated based on the test type and parameters.
$$

$$section
### Display Name $(id="displayName")

Provide a user-friendly display name for your test case that will be shown in the UI. Unlike the technical name, the display name:
- Can contain spaces and special characters
- Should be descriptive and meaningful to business users
- Can include punctuation and formatting for readability
- Maximum length of 256 characters
- Does not need to be unique (though recommended for clarity)

The display name helps team members quickly understand the purpose and scope of the test case in dashboards, reports, and notifications. If left empty, the technical name will be used as the display name.
$$

$$section
### Description $(id="description")

Add a detailed description of what this test case validates and why it's important. The description helps team members understand:
- The purpose of the test
- Expected outcomes
- Business context or requirements
- Any special considerations or dependencies

Use markdown formatting to structure your description with headings, lists, and emphasis as needed.
$$

$$section
### Tags $(id="tags")

Add tags to categorize and organize your test cases. Tags help with:
- Grouping related tests together
- Filtering and searching for specific test types
- Creating test execution workflows
- Documenting test categories (e.g., "critical", "regression", "performance")

You can select from existing tags or create new ones. Multiple tags can be added to a single test case.
$$

$$section
### Glossary Terms $(id="glossaryTerms")

Associate glossary terms with your test case to provide business context and standardized definitions. Glossary terms:
- Link technical tests to business concepts
- Provide consistent terminology across teams
- Help with documentation and knowledge sharing
- Enable better understanding of test purposes

Select from your organization's glossary to ensure alignment with established business terminology.
$$

$$section
### Create Pipeline $(id="createPipeline")

Enable automated execution of your test case by creating a pipeline. When enabled:
- Tests run automatically based on the configured schedule
- Results are tracked over time for trend analysis
- Alerts can be configured for test failures
- Multiple test cases can be grouped for batch execution

Configure the schedule using cron expressions or select from predefined intervals (hourly, daily, weekly).
$$

$$section
### Select All Test Cases $(id="selectAllTestCases")

When creating a pipeline, you can choose to include all existing test cases for the selected table. This option:
- Automatically includes all current test cases in the pipeline
- Includes any future test cases added to the table
- Simplifies pipeline management for comprehensive testing
- Ensures complete coverage without manual selection

If disabled, you can manually select specific test cases to include in the pipeline.
$$

$$section
### Test Cases $(id="testCases")

When not selecting all test cases, manually choose which specific test cases to include in the pipeline. This allows you to:
- Create focused test suites for specific scenarios
- Group related tests for targeted validation
- Control execution scope and performance
- Manage different testing strategies (smoke tests, regression tests, etc.)

Select multiple test cases from the available list for the chosen table.
$$

$$section
### Schedule Interval $(id="cron")

Define when and how often the test pipeline should run. You can:
- Use predefined intervals (Hourly, Daily, Weekly, Monthly)
- Create custom schedules using cron expressions
- Set specific times for test execution
- Configure timezone settings

The schedule determines the frequency of data quality checks and helps maintain continuous monitoring of your data assets.
$$


# Test Definitions Reference

This section provides detailed documentation for all available test definitions, their parameters, and use cases.

## Data Quality Dimensions

Tests are categorized into seven data quality dimensions:

- **Completeness**: Tests for missing or null values
- **Accuracy**: Tests for correctness and precision of data values  
- **Consistency**: Tests for uniformity and coherence across data
- **Validity**: Tests for conformity to defined formats and patterns
- **Uniqueness**: Tests for duplicate detection and uniqueness constraints
- **Integrity**: Tests for referential integrity and structural consistency
- **SQL**: Custom SQL-based validation tests

## Test Platforms

All test definitions support the following platforms:
- **OpenMetadata** (native platform)
- **Great Expectations** 
- **DBT**
- **Deequ**
- **Soda**
- **Other** (custom implementations)


## Column-Level Test Definitions

### Statistical Tests

$$section
#### Column Value Mean To Be Between $(id="columnValueMeanToBeBetween")

**Dimension**: Accuracy  

**Description**: Tests that the mean (average) value in a numeric column falls within a specified range.

**Parameters**:
- **Min** (INT) - The minimum acceptable average value for this column. The test will fail if the calculated mean is below this number
- **Max** (INT) - The maximum acceptable average value for this column. The test will fail if the calculated mean is above this number

**Supported Data Types**: NUMBER, INT, FLOAT, DOUBLE, DECIMAL, TINYINT, SMALLINT, BIGINT, BYTEINT, ARRAY, SET

**Use Cases**:
- Validating average transaction amounts
- Checking mean sensor readings
- Monitoring average response times
- Quality control for measurement data

**Dynamic Assertion**: Supported
$$

$$section
#### Column Value Max To Be Between $(id="columnValueMaxToBeBetween")

**Dimension**: Accuracy  

**Description**: Tests that the maximum value in a numeric column falls within a specified range.

**Parameters**:
- **Min** (INT) - The lowest acceptable value for the column's maximum. The test will fail if the highest value in the column is below this threshold
- **Max** (INT) - The highest acceptable value for the column's maximum. The test will fail if the highest value in the column is above this threshold

**Supported Data Types**: NUMBER, INT, FLOAT, DOUBLE, DECIMAL, TINYINT, SMALLINT, BIGINT, BYTEINT

**Use Cases**:
- Validating price ranges
- Checking temperature limits
- Monitoring system resource usage peaks
- Data boundary validation

**Dynamic Assertion**: Supported
$$

$$section
#### Column Value Min To Be Between $(id="columnValueMinToBeBetween")

**Dimension**: Accuracy  

**Description**: Tests that the minimum value in a numeric column falls within a specified range.

**Parameters**:
- **Min** (INT) - The lowest acceptable value for the column's minimum. The test will fail if the smallest value in the column is below this threshold
- **Max** (INT) - The highest acceptable value for the column's minimum. The test will fail if the smallest value in the column is above this threshold

**Supported Data Types**: NUMBER, INT, FLOAT, DOUBLE, DECIMAL, TINYINT, SMALLINT, BIGINT, BYTEINT

**Use Cases**:
- Ensuring no negative values where inappropriate
- Validating minimum thresholds
- Data quality checks for rates and percentages
- System performance monitoring

**Dynamic Assertion**: Supported
$$

$$section
#### Column Value Median To Be Between $(id="columnValueMedianToBeBetween")

**Dimension**: Accuracy  

**Description**: Tests that the median value in a numeric column falls within a specified range.

**Parameters**:
- **Min** (INT) - The minimum acceptable median value for this column. The test will fail if the calculated median is below this number
- **Max** (INT) - The maximum acceptable median value for this column. The test will fail if the calculated median is above this number

**Supported Data Types**: NUMBER, INT, FLOAT, DOUBLE, DECIMAL, TINYINT, SMALLINT, BIGINT, BYTEINT

**Use Cases**:
- Statistical validation of distributions
- Outlier detection support
- Financial data validation
- Performance metrics validation

**Dynamic Assertion**: Supported
$$

$$section
#### Column Value Standard Deviation To Be Between $(id="columnValueStdDevToBeBetween")

**Dimension**: Accuracy  

**Description**: Tests that the standard deviation of values in a numeric column falls within a specified range.

**Parameters**:
- **Min** (INT) - The minimum acceptable standard deviation for this column. Lower values indicate less data variation
- **Max** (INT) - The maximum acceptable standard deviation for this column. Higher values indicate more data variation

**Supported Data Types**: NUMBER, INT, FLOAT, DOUBLE, DECIMAL, TINYINT, SMALLINT, BIGINT, BYTEINT

**Use Cases**:
- Data consistency validation
- Volatility checks in financial data
- Quality control in manufacturing
- Detecting data anomalies

**Dynamic Assertion**: Supported
$$

$$section
#### Column Values Sum To Be Between $(id="columnValuesSumToBeBetween")

**Dimension**: Accuracy  

**Description**: Tests that the sum of all values in a numeric column falls within a specified range.

**Parameters**:
- **Min** (INT) - The minimum acceptable total when all column values are added together
- **Max** (INT) - The maximum acceptable total when all column values are added together

**Supported Data Types**: NUMBER, INT, FLOAT, DOUBLE, DECIMAL, TINYINT, SMALLINT, BIGINT, BYTEINT

**Use Cases**:
- Financial reconciliation checks
- Inventory validation
- Budget verification
- Resource allocation validation

**Dynamic Assertion**: Supported
$$

### Data Quality Tests

$$section
#### Column Values To Be Not Null $(id="columnValuesToBeNotNull")

**Dimension**: Completeness  

**Description**: Tests that values in a column are not null. Empty strings don't count as null - values must be explicitly null.

**Parameters**: None

**Supported Data Types**: All data types supported

**Use Cases**:
- Mandatory field validation
- Data completeness checks
- Required information verification
- Data ingestion quality control

**Row-Level Support**: Yes - shows which specific rows contain null values
$$

$$section
#### Column Values To Be Unique $(id="columnValuesToBeUnique")

**Dimension**: Uniqueness  

**Description**: Tests that all values in a column are unique (no duplicates).

**Parameters**: None

**Supported Data Types**: All data types supported

**Use Cases**:
- Primary key validation
- Unique identifier checks
- Email address uniqueness
- Account number validation

**Row-Level Support**: Yes - identifies duplicate values and their locations
$$

$$section
#### Column Values To Be Between $(id="columnValuesToBeBetween")

**Dimension**: Accuracy  

**Description**: Tests that all individual values in a numeric column fall within a specified range.

**Parameters**:
- **Min** (INT) - The smallest acceptable value for any individual entry in this column. Leave empty if you only want to set an upper limit
- **Max** (INT) - The largest acceptable value for any individual entry in this column. Leave empty if you only want to set a lower limit

**Supported Data Types**: NUMBER, INT, FLOAT, DOUBLE, DECIMAL, TINYINT, SMALLINT, BIGINT, BYTEINT, TIMESTAMP, TIMESTAMPZ, DATETIME, DATE

**Use Cases**:
- Age validation (0-120)
- Percentage validation (0-100)
- Rating scale validation (1-5)
- Temperature range checks

**Row-Level Support**: Yes - shows values outside the acceptable range
$$

$$section
#### Column Value Lengths To Be Between $(id="columnValueLengthsToBeBetween")

**Dimension**: Accuracy  

**Description**: Tests that the length of string/text values in a column falls within a specified range.

**Parameters**:
- **Min** (INT) - The shortest acceptable length for text values in this column (number of characters). Leave empty if you only want to set a maximum length
- **Max** (INT) - The longest acceptable length for text values in this column (number of characters). Leave empty if you only want to set a minimum length

**Supported Data Types**: BYTES, STRING, MEDIUMTEXT, TEXT, CHAR, VARCHAR, ARRAY

**Use Cases**:
- Name field validation
- Description length checks
- Input validation
- Data format compliance

**Row-Level Support**: Yes - identifies strings with invalid lengths
$$

$$section
#### Column Values Missing Count $(id="columnValuesMissingCount")

**Dimension**: Completeness  

**Description**: Tests that the exact number of missing/null values in a column equals a specific expected count.

**Parameters**:
- **Missing Count** (INT, Required) - The exact number of missing/null values you expect to find in this column
- **Missing Value to Match** (STRING, Optional) - Additional text values to treat as missing beyond null and empty values (e.g., 'N/A', 'NULL', 'Unknown')

**Supported Data Types**: All data types supported

**Use Cases**:
- Expected null value validation
- Data completeness monitoring
- Partial data load verification
- Survey response validation

**Row-Level Support**: Yes
$$

### Pattern & Set Tests

$$section
#### Column Values To Match Regex $(id="columnValuesToMatchRegex")

**Dimension**: Validity  

**Description**: Tests that values in a column match a specified regular expression pattern. For databases without regex support (MSSQL, AzureSQL), uses LIKE operator.

**Parameters**:
- **RegEx Pattern** (STRING, Required) - The regular expression pattern that all values in this column must match. For example, use `^[A-Z]{2}\\d{4}$` to match patterns like 'AB1234'

**Supported Data Types**: BYTES, STRING, MEDIUMTEXT, TEXT, CHAR, VARCHAR

**Use Cases**:
- Email format validation (`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
- Phone number formats (`^\+?1?-?\.?\s?\(?(\d{3})\)?[\s\.-]?(\d{3})[\s\.-]?(\d{4})$`)
- Product code validation (`^[A-Z]{2}\d{4}$`)
- Custom format compliance

**Row-Level Support**: Yes - shows values that don't match the pattern
$$

$$section
#### Column Values To Not Match Regex $(id="columnValuesToNotMatchRegex")

**Dimension**: Validity  

**Description**: Tests that values in a column do NOT match a specified regular expression pattern (inverse of regex match).

**Parameters**:
- **RegEx Pattern** (STRING, Required) - The regular expression pattern that values in this column must NOT match. Any value matching this pattern will cause the test to fail

**Supported Data Types**: BYTES, STRING, MEDIUMTEXT, TEXT, CHAR, VARCHAR

**Use Cases**:
- Profanity detection
- Sensitive data identification
- Invalid character detection
- Data cleansing validation

**Row-Level Support**: Yes - shows values that incorrectly match the forbidden pattern
$$

$$section
#### Column Values To Be In Set $(id="columnValuesToBeInSet")

**Dimension**: Validity  

**Description**: Tests that all values in a column are members of a specified set of allowed values.

**Parameters**:
- **Allowed Values** (ARRAY, Required) - List of acceptable values for this column. Any value not in this list will cause the test to fail
- **Match enum** (BOOLEAN, Optional) - When enabled, validates each value independently against the allowed set

**Supported Data Types**: NUMBER, INT, FLOAT, DOUBLE, DECIMAL, TINYINT, SMALLINT, BIGINT, BYTEINT, BYTES, STRING, MEDIUMTEXT, TEXT, CHAR, VARCHAR, BOOLEAN

**Use Cases**:
- Status field validation (`['active', 'inactive', 'pending']`)
- Category validation (`['bronze', 'silver', 'gold', 'platinum']`)
- Country code validation
- Priority level validation

**Row-Level Support**: Yes - identifies values not in the allowed set
$$

$$section
#### Column Values To Be Not In Set $(id="columnValuesToBeNotInSet")

**Dimension**: Validity  

**Description**: Tests that no values in a column are members of a specified set of forbidden values.

**Parameters**:
- **Forbidden Values** (ARRAY, Required) - List of values that must not appear in this column. Finding any of these values will cause the test to fail

**Supported Data Types**: NUMBER, INT, FLOAT, DOUBLE, DECIMAL, TINYINT, SMALLINT, BIGINT, BYTEINT, BYTES, STRING, MEDIUMTEXT, TEXT, CHAR, VARCHAR, BOOLEAN

**Use Cases**:
- Restricted value detection
- Data quality validation
- Blacklist enforcement
- Content moderation

**Row-Level Support**: Yes - shows prohibited values found in the column
$$

### Location Tests

$$section
#### Column Value To Be At Expected Location $(id="columnValueToBeAtExpectedLocation")

**Dimension**: Accuracy  

**Description**: Tests that lat/long values in a column are at the specified location within a given radius.

**Parameters**:
- **Location Reference Type** (ARRAY, Required) - How to identify the expected location: choose `CITY` or `POSTAL_CODE`
- **Longitude Column Name (X)** (STRING, Required) - Name of the column containing longitude coordinates in your table
- **Latitude Column Name (Y)** (STRING, Required) - Name of the column containing latitude coordinates in your table
- **Radius (in meters) from the expected location** (FLOAT, Required) - How far in meters the actual coordinates can be from the expected location before the test fails

**Supported Data Types**: BYTES, STRING, MEDIUMTEXT, TEXT, CHAR, VARCHAR, NUMBER, INT, FLOAT, DOUBLE, DECIMAL, TINYINT, SMALLINT, BIGINT, BYTEINT

**Use Cases**:
- GPS coordinate validation
- Address verification
- Geographic data quality
- Location-based service validation

**Row-Level Support**: No
$$


## Table-Level Test Definitions

### Row Count Tests

$$section
#### Table Row Count To Be Between $(id="tableRowCountToBeBetween")

**Dimension**: Integrity  

**Description**: Tests that the total number of rows in a table falls within a specified range.

**Parameters**:
- **Min** (INT) - The minimum number of rows this table should contain. Leave empty if you only want to set a maximum
- **Max** (INT) - The maximum number of rows this table should contain. Leave empty if you only want to set a minimum

**Use Cases**:
- Data completeness validation
- ETL process verification
- Table size monitoring
- Data volume quality checks

**Dynamic Assertion**: Supported
**Validation Rules**: minValue must be ≤ maxValue
$$

$$section
#### Table Row Count To Equal $(id="tableRowCountToEqual")

**Dimension**: Integrity  

**Description**: Tests that the total number of rows in a table exactly equals a specified value.

**Parameters**:
- **Count** (INT, Required) - The exact number of rows this table must contain

**Use Cases**:
- Reference table validation
- Complete data migration verification
- Fixed dataset validation
- Lookup table integrity

**Dynamic Assertion**: Supported
$$

$$section
#### Table Row Inserted Count To Be Between $(id="tableRowInsertedCountToBeBetween")

**Dimension**: Integrity  

**Description**: Tests that the number of newly inserted rows (within a specified time period) falls within a range.

**Parameters**:
- **Min Row Count** (INT, Optional) - Minimum number of new rows expected in the time period
- **Max Row Count** (INT, Optional) - Maximum number of new rows expected in the time period
- **Column Name** (STRING, Required) - Name of the timestamp/date column used to identify new records
- **Range Type** (STRING, Required) - Time unit for measuring new records: 'HOUR', 'DAY', 'MONTH', or 'YEAR'
- **Interval** (INT, Required) - Number of time units to look back. For example, Interval=1 and Range Type=DAY means 'check rows added in the last 1 day'

**Use Cases**:
- ETL monitoring
- Data ingestion rate validation
- Business activity monitoring
- Growth trend validation

**Dynamic Assertion**: Supported
$$

### Schema Tests

$$section
#### Table Column Count To Be Between $(id="tableColumnCountToBeBetween")

**Dimension**: Consistency  

**Description**: Tests that the number of columns in a table falls within a specified range.

**Parameters**:
- **Min** (INT) - The minimum number of columns this table should have. Leave empty if you only want to set a maximum
- **Max** (INT) - The maximum number of columns this table should have. Leave empty if you only want to set a minimum

**Use Cases**:
- Schema evolution monitoring
- Table structure validation
- Data model compliance
- Migration verification

**Dynamic Assertion**: Supported
$$

$$section
#### Table Column Count To Equal $(id="tableColumnCountToEqual")

**Dimension**: Consistency  

**Description**: Tests that the number of columns in a table exactly equals a specified value.

**Parameters**:
- **Count** (INT, Required) - The exact number of columns this table must have

**Use Cases**:
- Strict schema validation
- Template compliance checking
- Data contract enforcement
- Schema regression testing

**Dynamic Assertion**: Supported
$$

$$section
#### Table Column Name To Exist $(id="tableColumnNameToExist")

**Dimension**: Integrity  

**Description**: Tests that a table contains a column with a specific name.

**Parameters**:
- **Column Name** (STRING, Required) - The name of the column that must exist in this table

**Use Cases**:
- Required field validation
- Schema migration verification
- API contract validation
- Data model compliance

**Dynamic Assertion**: Not supported
$$

$$section
#### Table Column To Match Set $(id="tableColumnToMatchSet")

**Dimension**: Integrity  

**Description**: Tests that the table column names match a set of values. Unordered by default.

**Parameters**:
- **Column Names** (STRING, Required) - List of expected column names separated by commas (e.g., 'id,name,email,created_date')
- **Ordered** (BOOLEAN, Optional) - When enabled, the columns must appear in the exact order specified. When disabled, columns can be in any order

**Use Cases**:
- Complete schema validation
- Data warehouse table verification
- Schema compliance testing
- Table standardization checks

**Dynamic Assertion**: Not supported
$$

### Custom & Advanced Tests

$$section
#### Custom SQL Query $(id="tableCustomSQLQuery")

**Dimension**: SQL  

**Description**: Tests using custom SQL queries that should return 0 rows or COUNT(*) == 0 for the test to pass.

**Parameters**:
- **SQL Expression** (STRING, Required) - Your custom SQL query to run against the table. Write it to return rows that represent problems (test passes when query returns 0 rows)
- **Strategy** (ARRAY, Optional) - How to evaluate results: `ROWS` (count returned rows) or `COUNT` (use COUNT() in your query)
- **Operator** (STRING, Optional) - How to compare the result: `==` (equals), `>` (greater than), `>=` (greater or equal), `<` (less than), `<=` (less or equal), `!=` (not equal)
- **Threshold** (NUMBER, Optional) - The number to compare against (default is 0, meaning 'no problems found')
- **Partition Expression** (STRING, Optional) - SQL expression to group results for row-level analysis

**Strategy Options**:
- `ROWS`: Execute query and check if it returns rows
- `COUNT`: Execute query with COUNT() and compare to threshold

**Use Cases**:
- Complex business rule validation
- Cross-table referential integrity
- Custom data quality checks
- Domain-specific validations

**Examples**:
```sql
-- Check for orphaned records
SELECT * FROM orders WHERE customer_id NOT IN (SELECT id FROM customers)

-- Validate business rules  
SELECT * FROM products WHERE price <= 0 OR price > 10000

-- Time-based validations
SELECT * FROM events WHERE created_date > CURRENT_DATE
```

**Row-Level Support**: Yes (with partition expression)
$$

$$section
#### Table Diff $(id="tableDiff")

**Dimension**: Consistency  

**Description**: Compares two tables and identifies differences in structure, content, or both.

**Parameters**:
- **Table 2** (STRING, Required) - Full name of the second table to compare against (e.g., 'database.schema.table_name')
- **Key Columns** (ARRAY, Optional) - Columns that uniquely identify each row for comparison. If not specified, the system will use primary key or unique columns
- **Threshold** (NUMBER, Optional) - Maximum number of different rows allowed before the test fails (default is 0 for exact match)
- **Use Columns** (ARRAY, Optional) - Specific columns to compare. If not specified, all columns except key columns will be compared
- **SQL Where Clause** (STRING, Optional) - Condition to filter which rows to include in the comparison (e.g., 'status = "active"')
- **Case sensitive columns** (BOOLEAN, Optional) - When enabled, column name comparison is case-sensitive (e.g., 'Name' ≠ 'name')

**Key Features**:
- Automatically resolves key columns from primary key or unique constraints if not specified
- Supports filtering with SQL WHERE clauses
- Case-sensitive column comparison option
- Configurable difference threshold

**Use Cases**:
- Data migration validation
- Environment synchronization
- Backup verification
- Data replication monitoring

**Dynamic Assertion**: Supported
$$



## Collate-Specific Extensions

### Data Freshness

$$section
#### Table Data To Be Fresh $(id="tableDataToBeFresh")

**Dimension**: Accuracy  

**Description**: **Collate-specific test** that validates if the data in a table has been updated within an allowed time frame.

**Parameters**:
- **Column** (STRING, Required) - Name of the timestamp column that tracks when data was last updated (e.g., 'updated_at', 'created_date')
- **Time Since Update** (INT, Required) - Maximum allowed time since the last update before considering data stale
- **Time Unit** (ARRAY, Required) - Unit of time to measure staleness: SECONDS, MINUTES, HOURS, DAYS, WEEKS, MONTHS, or YEARS

**Time Units**: SECONDS, MINUTES, HOURS, DAYS, WEEKS, MONTHS, YEARS

**Use Cases**:
- Real-time data freshness monitoring
- ETL pipeline validation
- Data staleness detection
- SLA compliance monitoring

**Examples**:
- Ensure customer data is updated within 24 hours
- Validate sensor data is fresh within 5 minutes
- Check daily reports are generated within 2 hours

**Dynamic Assertion**: Not supported
**Provider**: System (Collate)
$$



## Advanced Features

### Row-Level Pass/Failed Support

Many test definitions support row-level pass/failed analysis, which provides:
- **Detailed Failure Information**: See exactly which rows failed the test
- **Sample Data**: View sample failing records for debugging
- **Failure Patterns**: Identify common failure scenarios
- **Data Quality Scoring**: Calculate pass/fail ratios at the row level

Tests with row-level support are marked with "**Row-Level Support**: Yes" in their documentation.

### Dynamic Assertions

Tests marked as supporting dynamic assertions can:
- **Auto-adjust thresholds** based on historical data patterns
- **Learn from data trends** to set appropriate bounds
- **Reduce false positives** by adapting to normal data variations
- **Provide intelligent recommendations** for test parameters

### Validation Rules

Some test parameters include validation rules to ensure:
- **Parameter Consistency**: minValue ≤ maxValue relationships
- **Logical Constraints**: Prevent impossible or contradictory configurations  
- **Data Type Compatibility**: Ensure parameters match expected data types
- **Business Logic**: Enforce domain-specific validation rules



## Best Practices

### Test Selection Guidelines

1. **Start with Basic Tests**: Begin with null checks, uniqueness, and range validations
2. **Layer Complexity**: Add statistical and pattern-based tests as needed
3. **Custom SQL for Complex Rules**: Use custom SQL tests for business-specific validations
4. **Monitor Performance**: Balance test coverage with execution time

### Parameter Configuration

1. **Use Realistic Ranges**: Base min/max values on actual data analysis
2. **Consider Data Growth**: Account for natural data volume increases
3. **Regular Review**: Update test parameters as business rules evolve
4. **Document Business Context**: Clearly explain why specific thresholds were chosen

### Monitoring Strategy

1. **Critical vs. Warning**: Classify tests by business impact
2. **Trend Analysis**: Monitor test results over time for patterns
3. **Alert Fatigue**: Avoid over-alerting with too many sensitive tests
4. **Root Cause Analysis**: Use row-level details for faster problem resolution