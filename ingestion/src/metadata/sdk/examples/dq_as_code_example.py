"""
Example: Data Quality as Code with OpenMetadata SDK

This example demonstrates how to run data quality tests programmatically
using the simplified DQ as Code API.

Installation:
    For MySQL tables:
        pip install 'openmetadata-ingestion[mysql]'

    For other databases, replace [mysql] with your database type:
        pip install 'openmetadata-ingestion[postgres]'
        pip install 'openmetadata-ingestion[snowflake]'
        pip install 'openmetadata-ingestion[clickhouse]'
"""

# pyright: reportUnusedCallResult=false
# pylint: disable=W5001
from metadata.sdk import configure
from metadata.sdk.data_quality import (
    ColumnValuesToBeNotNull,
    ColumnValuesToBeUnique,
    TableColumnCountToBeBetween,
    TableRowCountToBeBetween,
    TestRunner,
)

# Configure SDK connection
configure(
    host="http://localhost:8585/api",
    jwt_token="your-jwt-token-here",
)

# Initialize test runner for a specific table
runner = TestRunner.for_table("MySQL.default.openmetadata_db.bot_entity")

# Add multiple tests
runner.add_test(
    TableColumnCountToBeBetween(min_count=10).with_description(
        "Ensure bot_entity table has at least 10 columns"
    )
)

runner.add_test(
    TableRowCountToBeBetween(min_count=1, max_count=1000).with_description(
        "Check bot_entity has reasonable number of rows"
    )
)

runner.add_test(
    ColumnValuesToBeUnique(column="id")
    .with_name("bot_entity_id_unique")
    .with_compute_row_count(True)
)

runner.add_test(ColumnValuesToBeNotNull(column="name"))

# Execute all tests
print("Running data quality tests...")
results = runner.run()

# Process results
for result in results:
    test_case = result.testCase
    test_result = result.testCaseResult

    print(f"\nTest: {test_case.name.root}")
    print(f"Status: {test_result.testCaseStatus}")
    print(f"Result: {test_result.result}")

    if test_result.passedRows is not None:
        print(f"Passed Rows: {test_result.passedRows}")
        print(f"Failed Rows: {test_result.failedRows}")
        print(f"Pass Rate: {test_result.passedRowsPercentage:.2f}%")

print(f"\n✅ All tests completed! {len(results)} tests executed.")
