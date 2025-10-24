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

"""Unit tests for DataFrame validator."""

import pandas as pd
import pytest

from metadata.generated.schema.tests.basic import TestCaseStatus
from metadata.sdk.data_quality import (
    ColumnValuesToBeNotNull,
    ColumnValuesToBeUnique,
    DataFrameValidator,
    TableRowCountToBeBetween,
)
from metadata.sdk.data_quality.dataframes import FailureMode


class TestDataFrameValidator:
    """Test DataFrameValidator initialization and configuration."""

    def test_validator_initialization(self):
        """Test validator can be created."""
        validator = DataFrameValidator()
        assert validator is not None
        assert validator._test_definitions == []

    def test_add_single_test(self):
        """Test adding a single test definition."""
        validator = DataFrameValidator()
        validator.add_test(ColumnValuesToBeNotNull(column="email"))
        assert len(validator._test_definitions) == 1

    def test_add_multiple_tests(self):
        """Test adding multiple test definitions at once."""
        validator = DataFrameValidator()
        validator.add_tests(
            ColumnValuesToBeNotNull(column="email"),
            ColumnValuesToBeUnique(column="id"),
            TableRowCountToBeBetween(min_count=1, max_count=100),
        )
        assert len(validator._test_definitions) == 3


class TestValidationSuccess:
    """Test successful validation scenarios."""

    def test_validate_not_null_success(self):
        """Test validation passes with valid DataFrame."""
        df = pd.DataFrame({"email": ["a@b.com", "c@d.com", "e@f.com"]})
        validator = DataFrameValidator()
        validator.add_test(ColumnValuesToBeNotNull(column="email"))

        result = validator.validate(df)

        assert result.success is True
        assert result.passed_tests == 1
        assert result.failed_tests == 0
        assert len(result.test_results) == 1
        assert result.test_results[0].status == TestCaseStatus.Success

    def test_validate_unique_success(self):
        """Test uniqueness validation passes."""
        df = pd.DataFrame({"id": [1, 2, 3, 4, 5]})
        validator = DataFrameValidator()
        validator.add_test(ColumnValuesToBeUnique(column="id"))

        result = validator.validate(df)

        assert result.success is True
        assert result.passed_tests == 1

    def test_validate_multiple_tests_success(self):
        """Test multiple tests all passing."""
        df = pd.DataFrame(
            {
                "id": [1, 2, 3],
                "email": ["a@b.com", "c@d.com", "e@f.com"],
                "age": [25, 30, 35],
            }
        )
        validator = DataFrameValidator()
        validator.add_tests(
            ColumnValuesToBeNotNull(column="email"),
            ColumnValuesToBeUnique(column="id"),
            TableRowCountToBeBetween(min_count=1, max_count=10),
        )

        result = validator.validate(df)

        assert result.success is True
        assert result.passed_tests == 3
        assert result.failed_tests == 0


class TestValidationFailure:
    """Test validation failure scenarios."""

    def test_validate_not_null_failure(self):
        """Test validation fails with null values."""
        df = pd.DataFrame({"email": ["a@b.com", None, "e@f.com"]})
        validator = DataFrameValidator()
        validator.add_test(ColumnValuesToBeNotNull(column="email"))

        result = validator.validate(df)

        assert result.success is False
        assert result.passed_tests == 0
        assert result.failed_tests == 1
        assert result.test_results[0].status == TestCaseStatus.Failed

    def test_validate_unique_failure(self):
        """Test uniqueness validation fails with duplicates."""
        df = pd.DataFrame({"id": [1, 2, 2, 3]})
        validator = DataFrameValidator()
        validator.add_test(ColumnValuesToBeUnique(column="id"))

        result = validator.validate(df)

        assert result.success is False
        assert result.failed_tests == 1

    def test_validate_row_count_failure(self):
        """Test row count validation fails."""
        df = pd.DataFrame({"col": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]})
        validator = DataFrameValidator()
        validator.add_test(TableRowCountToBeBetween(min_count=1, max_count=10))

        result = validator.validate(df)

        assert result.success is False


class TestShortCircuitMode:
    """Test short-circuit validation mode."""

    def test_short_circuit_stops_on_first_failure(self):
        """Test short-circuit mode stops after first failure."""
        df = pd.DataFrame(
            {
                "id": [1, 2, 2],
                "email": [None, None, None],
            }
        )
        validator = DataFrameValidator()
        validator.add_tests(
            ColumnValuesToBeUnique(column="id"),
            ColumnValuesToBeNotNull(column="email"),
        )

        result = validator.validate(df, mode=FailureMode.ShortCircuit)

        assert result.success is False
        assert len(result.test_results) == 1

    def test_short_circuit_continues_on_success(self):
        """Test short-circuit mode continues when tests pass."""
        df = pd.DataFrame(
            {
                "id": [1, 2, 3],
                "email": ["a@b.com", "c@d.com", "e@f.com"],
            }
        )
        validator = DataFrameValidator()
        validator.add_tests(
            ColumnValuesToBeUnique(column="id"),
            ColumnValuesToBeNotNull(column="email"),
        )

        result = validator.validate(df, mode="short-circuit")

        assert result.success is True
        assert len(result.test_results) == 2


class TestValidationResultProperties:
    """Test ValidationResult helper properties."""

    def test_failures_property(self):
        """Test failures property returns only failed tests."""
        df = pd.DataFrame(
            {
                "id": [1, 2, 2],
                "email": ["a@b.com", "c@d.com", "e@f.com"],
            }
        )
        validator = DataFrameValidator()
        validator.add_tests(
            ColumnValuesToBeUnique(column="id"),
            ColumnValuesToBeNotNull(column="email"),
        )

        result = validator.validate(df, mode="short-circuit")

        assert len(result.failures) == 1
        assert result.failures[0].test_type == "columnValuesToBeUnique"

    def test_passes_property(self):
        """Test passes property returns only passed tests."""
        df = pd.DataFrame(
            {
                "id": [1, 2, 3],
                "email": ["a@b.com", None, "e@f.com"],
            }
        )
        validator = DataFrameValidator()
        validator.add_tests(
            ColumnValuesToBeUnique(column="id"),
            ColumnValuesToBeNotNull(column="email"),
        )

        result = validator.validate(df, mode="short-circuit")

        assert len(result.passes) == 1
        assert result.passes[0].test_type == "columnValuesToBeUnique"


class TestEdgeCases:
    """Test edge cases and error conditions."""

    def test_empty_dataframe(self):
        """Test validation on empty DataFrame."""
        df = pd.DataFrame({"email": []})
        validator = DataFrameValidator()
        validator.add_test(ColumnValuesToBeNotNull(column="email"))

        result = validator.validate(df)

        assert result.success is True
        assert result.test_results[0].total_rows == 0

    def test_missing_column(self):
        """Test validation with missing column."""
        df = pd.DataFrame({"name": ["Alice", "Bob"]})
        validator = DataFrameValidator()
        validator.add_test(ColumnValuesToBeNotNull(column="email"))

        result = validator.validate(df)

        assert result.success is False
        assert result.test_results[0].status == TestCaseStatus.Aborted

    def test_no_tests_configured(self):
        """Test validation with no tests configured."""
        df = pd.DataFrame({"col": [1, 2, 3]})
        validator = DataFrameValidator()

        result = validator.validate(df)

        assert result.success is True
        assert result.total_tests == 0
        assert len(result.test_results) == 0

    def test_execution_time_recorded(self):
        """Test that execution time is recorded."""
        df = pd.DataFrame({"col": [1, 2, 3]})
        validator = DataFrameValidator()
        validator.add_test(TableRowCountToBeBetween(min_count=1, max_count=10))

        result = validator.validate(df)

        assert result.execution_time_ms > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
