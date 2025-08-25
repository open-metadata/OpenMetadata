# Data Quality

OpenMetadata supports comprehensive data quality testing to help ensure your data meets defined standards and expectations.

$$section
### Test Level $(id="testLevel")

Select the level at which you want to apply the test case. Choose between:
- **Table Level**: Tests that validate entire table properties such as row count, freshness, or custom SQL queries
- **Column Level**: Tests that validate specific column properties such as values, uniqueness, or data types

The test level determines which test types will be available for selection.
$$

$$section
### Table $(id="selectedTable")

Select the table on which you want to create the test case. You can search for tables by name or browse through the available options. The selected table will be the target for your data quality tests.

For column-level tests, you'll need to select a specific column after choosing the table.
$$

$$section
### Column $(id="selectedColumn")

When creating column-level tests, select the specific column you want to test. The available columns are based on the selected table's schema. Column tests allow you to validate data at a granular level, checking for nulls, unique values, data formats, and more.
$$

$$section
### Test Type $(id="testTypeId")

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
### Name $(id="testName")

Provide a unique name for your test case. The name should be descriptive and follow these guidelines:
- Must start with a letter
- Can contain letters, numbers, and underscores
- Cannot contain spaces or special characters
- Maximum length of 256 characters
- Must be unique within the test suite

If left empty, a name will be automatically generated based on the test type and parameters.
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