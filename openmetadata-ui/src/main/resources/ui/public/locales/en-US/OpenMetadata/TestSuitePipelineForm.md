# Test Suite Pipeline

A test suite pipeline runs the data quality tests of a table on a schedule, so results are tracked over time without running them by hand.

$$section
### Name $(id="name")

A display name for the pipeline, shown in the Pipelines list. If left empty, a name is generated from the table name.
$$

$$section
### Schedule Interval $(id="cron")

Define when and how often the test pipeline should run. You can:
- Use predefined intervals (Hourly, Daily, Weekly, Monthly)
- Create custom schedules using cron expressions
- Set specific times for test execution
- Choose On Demand to run the pipeline only when you trigger it

Align the schedule with how often the table is loaded, so each run checks fresh data.
$$

$$section
### Enable Debug Logs $(id="enableDebugLog")

Set the `Enable Debug Log` toggle to set the logging level of the pipeline to debug. You can check these logs from the Logs action in the Pipelines list and dig deeper into any errors you might find.
$$

$$section
### Raise on Error $(id="raiseOnError")

Mark the pipeline run as failed when a test raises an error, instead of finishing the run as successful.
$$

$$section
### Select All Test Cases $(id="selectAllTestCases")

Include all test cases of the table in the pipeline. This option:
- Automatically includes all current test cases in the pipeline
- Includes any future test cases added to the table
- Simplifies pipeline management for comprehensive testing

If disabled, you can manually select specific test cases to include in the pipeline.
$$

$$section
### Test Cases $(id="testCases")

When not selecting all test cases, choose which specific test cases the pipeline runs. This allows you to:
- Create focused runs for specific scenarios
- Group related tests for targeted validation
- Control execution scope and performance
- Run different testing strategies on different schedules (smoke tests, regression tests, etc.)
$$
