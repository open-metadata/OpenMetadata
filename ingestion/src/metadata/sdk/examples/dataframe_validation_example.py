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
    print("\n=== Basic DataFrame Validation Example ===\n")

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
        print("✓ All validations passed!")
        print(
            f"  Executed {result.total_tests} tests in {result.execution_time_ms:.2f}ms"
        )
    else:
        print("✗ Validation failed")
        for failure in result.failures:
            print(f"  - {failure.test_name}: {failure.result_message}")


def multiple_tests_example():
    """Example with multiple validation rules."""
    print("\n=== Multiple Tests Validation Example ===\n")

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

    print(f"Validation: {'PASSED' if result.success else 'FAILED'}")
    print(f"Tests: {result.passed_tests}/{result.total_tests} passed")
    print(f"Execution time: {result.execution_time_ms:.2f}ms\n")

    for test_result in result.test_results:
        status_icon = "✓" if test_result.status.value == "Success" else "✗"
        print(f"{status_icon} {test_result.test_name}")
        if test_result.passed_rows > 0:
            print(f"  Passed: {test_result.passed_rows}/{test_result.total_rows} rows")
        if test_result.failed_rows > 0:
            percentage = test_result.failed_rows / test_result.total_rows * 100
            print(f"  Failed: {test_result.failed_rows} rows ({percentage:.1f}%)")


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
    validator.add_openmetadata_table_tests(
        "DbService.database_name.schema_name.dwh_table"
    )

    result = validator.validate(df)
    print(f"Validation: {'PASSED' if result.success else 'FAILED'}")

    # Publish the results back to Open Metadata
    result.publish("DbService.database_name.schema_name.dwh_table")

    if result.success:
        df.to_parquet("s3://some_bucket/dwh_table.parquet")


def processing_big_data_with_chunks_example():
    """Processing big data with chunks."""

    configure(host="http://localhost:8585/api", jwt_token="your jwt token")

    validator = DataFrameValidator()
    validator.add_openmetadata_table_tests(
        "DbService.database_name.schema_name.dwh_table"
    )

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
    print("\n=== Validation Failure Example ===\n")

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

    print(f"Validation: {'PASSED' if result.success else 'FAILED'}\n")

    if not result.success:
        print("Failures detected:")
        for failure in result.failures:
            print(f"\n  Test: {failure.test_name}")
            print(f"  Type: {failure.test_type}")
            print(f"  Message: {failure.result_message}")
            print(f"  Failed rows: {failure.failed_rows}/{failure.total_rows}")


def etl_pipeline_integration_example():
    """Example integrating validation into an ETL pipeline."""
    print("\n=== ETL Pipeline Integration Example ===\n")

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
        print(f"Loading {len(df)} rows to data warehouse...")

    print("Starting ETL pipeline...")
    print("\n1. Extract")
    raw_df = extract_data()
    print(f"   Extracted {len(raw_df)} rows")

    print("\n2. Transform")
    transformed_df = transform_data(raw_df)
    print(f"   Transformed {len(transformed_df)} rows")

    print("\n3. Validate")
    validation_result = validate_data(transformed_df)

    if validation_result.success:
        print("   ✓ Validation passed")
        print("\n4. Load")
        load_data(transformed_df)
        print("   ✓ Data loaded successfully")
    else:
        print("   ✗ Validation failed")
        print("\n   Failures:")
        for failure in validation_result.failures:
            print(f"     - {failure.test_name}: {failure.result_message}")
        print("\n   Pipeline aborted - data not loaded")


def short_circuit_mode_example():
    """Example demonstrating short-circuit mode behavior."""
    print("\n=== Short-Circuit Mode Example ===\n")

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

    print("Short-circuit mode stops at first failure:")
    print(f"  Tests executed: {len(result.test_results)} of {result.total_tests}")
    print(f"  First failure: {result.failures[0].test_name}")
    print("\nRemaining tests were not executed due to short-circuit mode.")


if __name__ == "__main__":
    basic_validation_example()
    multiple_tests_example()
    validation_failure_example()
    etl_pipeline_integration_example()
    short_circuit_mode_example()
