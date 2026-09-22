#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""Examples demonstrating DataFrame validation with OpenMetadata SDK.

Installation:
    For basic DataFrame validation:
        pip install 'openmetadata-ingestion[pandas]'

    For reading Parquet files:
        pip install 'openmetadata-ingestion[pandas,pyarrow]'

    For reading from S3 datalakes:
        pip install 'openmetadata-ingestion[pandas,datalake-s3]'
"""

# pyright: reportUnknownVariableType=false, reportAttributeAccessIssue=false, reportUnknownMemberType=false
# pyright: reportUnusedCallResult=false
# pylint: disable=W5001
import pandas as pd

from metadata.sdk import configure
from metadata.sdk.data_quality import (
    ColumnValuesToBeBetween,
    ColumnValuesToBeNotNull,
    ColumnValuesToBeUnique,
    ColumnValuesToMatchRegex,
    TableRowCountToBeBetween,
)
from metadata.sdk.data_quality.dataframes.dataframe_validator import DataFrameValidator
from metadata.sdk.data_quality.dataframes.validation_results import (
    FailureMode,
    ValidationResult,
)


def basic_validation_example():
    """Basic example validating a customer DataFrame."""
    print("\n=== Basic DataFrame Validation Example ===\n")  # noqa: T201

    df = pd.DataFrame(
        {
            "customer_id": [1, 2, 3, 4, 5],
            "email": [
                "alice@example.com",
                "bob@example.com",
                "carol@example.com",
                "dave@example.com",
                "eve@example.com",
            ],
            "age": [25, 30, 35, 40, 45],
        }
    )

    validator = DataFrameValidator()
    validator.add_test(ColumnValuesToBeNotNull(column="email"))
    validator.add_test(ColumnValuesToBeUnique(column="customer_id"))

    result = validator.validate(df)

    if result.success:
        print("✓ All validations passed!")  # noqa: T201
        print(f"  Executed {result.total_tests} tests in {result.execution_time_ms:.2f}ms")  # noqa: T201
    else:
        print("✗ Validation failed")  # noqa: T201
        for failure in result.failures:
            print(f"  - {failure.test_name}: {failure.result_message}")  # noqa: T201


def multiple_tests_example():
    """Example with multiple validation rules."""
    print("\n=== Multiple Tests Validation Example ===\n")  # noqa: T201

    df = pd.DataFrame(
        {
            "customer_id": [1, 2, 3, 4, 5],
            "email": [
                "alice@example.com",
                "bob@example.com",
                "carol@example.com",
                "dave@example.com",
                "eve@example.com",
            ],
            "age": [25, 30, 35, 40, 45],
            "status": ["active", "active", "inactive", "active", "active"],
        }
    )

    validator = DataFrameValidator()
    validator.add_tests(
        TableRowCountToBeBetween(min_count=1, max_count=1000),
        ColumnValuesToBeNotNull(column="customer_id"),
        ColumnValuesToBeNotNull(column="email"),
        ColumnValuesToBeUnique(column="customer_id"),
        ColumnValuesToBeBetween(column="age", min_value=0, max_value=120),
        ColumnValuesToMatchRegex(column="email", regex=r"^[\w\.-]+@[\w\.-]+\.\w+$"),
    )

    result = validator.validate(df, mode=FailureMode.SHORT_CIRCUIT)

    print(f"Validation: {'PASSED' if result.success else 'FAILED'}")  # noqa: T201
    print(f"Tests: {result.passed_tests}/{result.total_tests} passed")  # noqa: T201
    print(f"Execution time: {result.execution_time_ms:.2f}ms\n")  # noqa: T201

    for test_result in result.test_results:
        status_icon = "✓" if test_result.status.value == "Success" else "✗"
        print(f"{status_icon} {test_result.test_name}")  # noqa: T201
        if test_result.passed_rows > 0:
            print(f"  Passed: {test_result.passed_rows}/{test_result.total_rows} rows")  # noqa: T201
        if test_result.failed_rows > 0:
            percentage = test_result.failed_rows / test_result.total_rows * 100
            print(f"  Failed: {test_result.failed_rows} rows ({percentage:.1f}%)")  # noqa: T201


def integrating_with_openmetadata_example():
    """Integrating with OpenMetadata."""

    def transform_to_dwh_table(raw_df: pd.DataFrame) -> pd.DataFrame:
        """Transform the dataframe to dwh table."""
        return raw_df

    configure(host="http://localhost:8585/api", jwt_token="your jwt token")

    df = pd.read_parquet("s3://some_bucket/raw_table.parquet")

    df = transform_to_dwh_table(df)

    # Instantiate validator and load the executable test suite for a table
    validator = DataFrameValidator()
    validator.add_openmetadata_table_tests("DbService.database_name.schema_name.dwh_table")

    result = validator.validate(df)
    print(f"Validation: {'PASSED' if result.success else 'FAILED'}")  # noqa: T201

    # Publish the results back to Open Metadata
    result.publish("DbService.database_name.schema_name.dwh_table")

    if result.success:
        df.to_parquet("s3://some_bucket/dwh_table.parquet")


def processing_big_data_with_chunks_example():
    """Processing big data with chunks."""

    configure(host="http://localhost:8585/api", jwt_token="your jwt token")

    validator = DataFrameValidator()
    validator.add_openmetadata_table_tests("DbService.database_name.schema_name.dwh_table")

    def load_df_to_destination(_df: pd.DataFrame, _result: ValidationResult):
        """Loads data into destination."""

    def rollback(_df: pd.DataFrame, _result: ValidationResult):
        """Clears data previously loaded"""

    results = validator.run(
        pd.read_csv("somefile.csv", chunksize=1000),
        on_success=load_df_to_destination,
        on_failure=rollback,
        mode=FailureMode.SHORT_CIRCUIT,
    )

    results.publish("DbService.database_name.schema_name.dwh_table")


def validation_failure_example():
    """Example demonstrating validation failures."""
    print("\n=== Validation Failure Example ===\n")  # noqa: T201

    df = pd.DataFrame(
        {
            "customer_id": [1, 2, 2, 4, 5],
            "email": [
                "alice@example.com",
                None,
                "carol@example.com",
                "dave@example.com",
                "invalid-email",
            ],
            "age": [25, 150, 35, -5, 45],
        }
    )

    validator = DataFrameValidator()
    validator.add_tests(
        ColumnValuesToBeUnique(column="customer_id"),
        ColumnValuesToBeNotNull(column="email"),
        ColumnValuesToBeBetween(column="age", min_value=0, max_value=120),
    )

    result = validator.validate(df, mode=FailureMode.SHORT_CIRCUIT)

    print(f"Validation: {'PASSED' if result.success else 'FAILED'}\n")  # noqa: T201

    if not result.success:
        print("Failures detected:")  # noqa: T201
        for failure in result.failures:
            print(f"\n  Test: {failure.test_name}")  # noqa: T201
            print(f"  Type: {failure.test_type}")  # noqa: T201
            print(f"  Message: {failure.result_message}")  # noqa: T201
            print(f"  Failed rows: {failure.failed_rows}/{failure.total_rows}")  # noqa: T201


def etl_pipeline_integration_example():
    """Example integrating validation into an ETL pipeline."""
    print("\n=== ETL Pipeline Integration Example ===\n")  # noqa: T201

    def extract_data():
        return pd.DataFrame(
            {
                "id": [1, 2, 3, 4, 5],
                "name": ["Alice", "Bob", "Carol", "Dave", "Eve"],
                "value": [100, 200, 300, 400, 500],
            }
        )

    def transform_data(df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        df["value_doubled"] = df["value"] * 2
        return df

    def validate_data(df: pd.DataFrame) -> ValidationResult:
        validator = DataFrameValidator()
        validator.add_tests(
            TableRowCountToBeBetween(min_count=1, max_count=10000),
            ColumnValuesToBeNotNull(column="id"),
            ColumnValuesToBeUnique(column="id"),
            ColumnValuesToBeBetween(column="value", min_value=0, max_value=10000),
        )
        return validator.validate(df, mode=FailureMode.SHORT_CIRCUIT)

    def load_data(df: pd.DataFrame) -> None:
        print(f"Loading {len(df)} rows to data warehouse...")  # noqa: T201

    print("Starting ETL pipeline...")  # noqa: T201
    print("\n1. Extract")  # noqa: T201
    raw_df = extract_data()
    print(f"   Extracted {len(raw_df)} rows")  # noqa: T201

    print("\n2. Transform")  # noqa: T201
    transformed_df = transform_data(raw_df)
    print(f"   Transformed {len(transformed_df)} rows")  # noqa: T201

    print("\n3. Validate")  # noqa: T201
    validation_result = validate_data(transformed_df)

    if validation_result.success:
        print("   ✓ Validation passed")  # noqa: T201
        print("\n4. Load")  # noqa: T201
        load_data(transformed_df)
        print("   ✓ Data loaded successfully")  # noqa: T201
    else:
        print("   ✗ Validation failed")  # noqa: T201
        print("\n   Failures:")  # noqa: T201
        for failure in validation_result.failures:
            print(f"     - {failure.test_name}: {failure.result_message}")  # noqa: T201
        print("\n   Pipeline aborted - data not loaded")  # noqa: T201


def short_circuit_mode_example():
    """Example demonstrating short-circuit mode behavior."""
    print("\n=== Short-Circuit Mode Example ===\n")  # noqa: T201

    df = pd.DataFrame(
        {
            "id": [1, 2, 2, 3],
            "email": [None, None, None, "test@example.com"],
            "age": [25, 30, 35, 40],
        }
    )

    validator = DataFrameValidator()
    validator.add_tests(
        ColumnValuesToBeUnique(column="id"),
        ColumnValuesToBeNotNull(column="email"),
        ColumnValuesToBeBetween(column="age", min_value=0, max_value=120),
    )

    result = validator.validate(df, mode=FailureMode.SHORT_CIRCUIT)

    print("Short-circuit mode stops at first failure:")  # noqa: T201
    print(f"  Tests executed: {len(result.test_results)} of {result.total_tests}")  # noqa: T201
    print(f"  First failure: {result.failures[0].test_name}")  # noqa: T201
    print("\nRemaining tests were not executed due to short-circuit mode.")  # noqa: T201


if __name__ == "__main__":
    basic_validation_example()
    multiple_tests_example()
    validation_failure_example()
    etl_pipeline_integration_example()
    short_circuit_mode_example()
