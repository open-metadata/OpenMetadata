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
from typing import Generator, List, Tuple
from unittest.mock import Mock

import pandas as pd
import pytest
from pandas import DataFrame

from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase
from metadata.sdk.data_quality import (
    ColumnValuesToBeNotNull,
    ColumnValuesToBeUnique,
    TableRowCountToBeBetween,
)
from metadata.sdk.data_quality.dataframes.custom_warnings import WholeTableTestsWarning
from metadata.sdk.data_quality.dataframes.dataframe_validator import DataFrameValidator
from metadata.sdk.data_quality.dataframes.validation_results import (
    FailureMode,
    ValidationResult,
)


class TestDataFrameValidator:
    """Test DataFrameValidator initialization and configuration."""

    def test_validator_initialization(self):
        """Test validator can be created."""
        validator = DataFrameValidator(Mock())
        assert validator is not None
        assert validator._test_cases == []

    def test_add_single_test(self):
        """Test adding a single test definition."""
        validator = DataFrameValidator(Mock())
        validator.add_test(ColumnValuesToBeNotNull(column="email"))
        assert len(validator._test_cases) == 1

    def test_add_multiple_tests(self):
        """Test adding multiple test definitions at once."""
        validator = DataFrameValidator(Mock())
        validator.add_tests(
            ColumnValuesToBeNotNull(column="email"),
            ColumnValuesToBeUnique(column="id"),
            TableRowCountToBeBetween(min_count=1, max_count=100),
        )
        assert len(validator._test_cases) == 3


class TestValidationSuccess:
    """Test successful validation scenarios."""

    def test_validate_not_null_success(self):
        """Test validation passes with valid DataFrame."""
        df = pd.DataFrame({"email": ["a@b.com", "c@d.com", "e@f.com"]})
        validator = DataFrameValidator(Mock())
        validator.add_test(ColumnValuesToBeNotNull(column="email"))

        result = validator.validate(df)

        assert result.success is True
        assert result.passed_tests == 1
        assert result.failed_tests == 0
        assert len(result.test_results) == 1
        assert result.test_results[0].testCaseStatus is TestCaseStatus.Success

    def test_validate_unique_success(self):
        """Test uniqueness validation passes."""
        df = pd.DataFrame({"id": [1, 2, 3, 4, 5]})
        validator = DataFrameValidator(Mock())
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
        validator = DataFrameValidator(Mock())
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
        validator = DataFrameValidator(Mock())
        validator.add_test(ColumnValuesToBeNotNull(column="email"))

        result = validator.validate(df)

        assert result.success is False
        assert result.passed_tests == 0
        assert result.failed_tests == 1
        assert result.test_results[0].testCaseStatus is TestCaseStatus.Failed

    def test_validate_unique_failure(self):
        """Test uniqueness validation fails with duplicates."""
        df = pd.DataFrame({"id": [1, 2, 2, 3]})
        validator = DataFrameValidator(Mock())
        validator.add_test(ColumnValuesToBeUnique(column="id"))

        result = validator.validate(df)

        assert result.success is False
        assert result.failed_tests == 1

    def test_validate_row_count_failure(self):
        """Test row count validation fails."""
        df = pd.DataFrame({"col": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]})
        validator = DataFrameValidator(Mock())
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
        validator = DataFrameValidator(Mock())
        validator.add_tests(
            ColumnValuesToBeUnique(column="id"),
            ColumnValuesToBeNotNull(column="email"),
        )

        result = validator.validate(df, mode=FailureMode.SHORT_CIRCUIT)

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
        validator = DataFrameValidator(Mock())
        validator.add_tests(
            ColumnValuesToBeUnique(column="id"),
            ColumnValuesToBeNotNull(column="email"),
        )

        result = validator.validate(df, mode=FailureMode.SHORT_CIRCUIT)

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
        validator = DataFrameValidator(Mock())
        validator.add_tests(
            ColumnValuesToBeUnique(column="id"),
            ColumnValuesToBeNotNull(column="email"),
        )

        result = validator.validate(df, mode=FailureMode.SHORT_CIRCUIT)

        assert len(result.failures) == 1

    def test_passes_property(self):
        """Test passes property returns only passed tests."""
        df = pd.DataFrame(
            {
                "id": [1, 2, 3],
                "email": ["a@b.com", None, "e@f.com"],
            }
        )
        validator = DataFrameValidator(Mock())
        validator.add_tests(
            ColumnValuesToBeUnique(column="id"),
            ColumnValuesToBeNotNull(column="email"),
        )

        result = validator.validate(df, mode=FailureMode.SHORT_CIRCUIT)

        assert len(result.passes) == 1


class TestEdgeCases:
    """Test edge cases and error conditions."""

    def test_empty_dataframe(self):
        """Test validation on empty DataFrame."""
        df = pd.DataFrame({"email": []})
        validator = DataFrameValidator(Mock())
        validator.add_test(ColumnValuesToBeNotNull(column="email"))

        result = validator.validate(df)

        assert result.success is True

    def test_missing_column(self):
        """Test validation with missing column."""
        df = pd.DataFrame({"name": ["Alice", "Bob"]})
        validator = DataFrameValidator(Mock())
        validator.add_test(ColumnValuesToBeNotNull(column="email"))

        result = validator.validate(df)

        assert result.success is False
        assert result.test_results[0].testCaseStatus is TestCaseStatus.Aborted

    def test_no_tests_configured(self):
        """Test validation with no tests configured."""
        df = pd.DataFrame({"col": [1, 2, 3]})
        validator = DataFrameValidator(Mock())

        result = validator.validate(df)

        assert result.success is True
        assert result.total_tests == 0
        assert len(result.test_results) == 0

    def test_execution_time_recorded(self):
        """Test that execution time is recorded."""
        df = pd.DataFrame({"col": [1, 2, 3]})
        validator = DataFrameValidator(Mock())
        validator.add_test(TableRowCountToBeBetween(min_count=1, max_count=10))

        result = validator.validate(df)

        assert result.execution_time_ms > 0


class TracksValidationCallbacks:
    def __init__(self) -> None:
        self.calls: List[Tuple[DataFrame, ValidationResult]] = []

    @property
    def times_called(self) -> int:
        return len(self.calls)

    @property
    def was_called(self) -> bool:
        return self.times_called > 0

    def __call__(self, df: DataFrame, result: ValidationResult) -> None:
        self.calls.append((df, result))


@pytest.mark.filterwarnings(
    "error::metadata.sdk.data_quality.dataframes.custom_warnings.WholeTableTestsWarning"
)
class TestValidatorRun:
    @pytest.fixture
    def on_success_callback(self) -> TracksValidationCallbacks:
        return TracksValidationCallbacks()

    @pytest.fixture
    def on_failure_callback(self) -> TracksValidationCallbacks:
        return TracksValidationCallbacks()

    @pytest.fixture
    def validator(self) -> DataFrameValidator:
        df_validator = DataFrameValidator(Mock())
        df_validator.add_tests(
            ColumnValuesToBeNotNull(column="id"),
        )
        return df_validator

    def test_it_only_calls_on_success(
        self,
        validator: DataFrameValidator,
        on_success_callback: TracksValidationCallbacks,
        on_failure_callback: TracksValidationCallbacks,
    ) -> None:
        dfs = (pd.DataFrame({"id": [i + 1, i + 2, i + 3]}) for i in range(0, 9, 3))

        validator.run(dfs, on_success_callback, on_failure_callback)

        assert on_success_callback.times_called == 3
        assert on_failure_callback.was_called is False

    def test_it_calls_both_on_success_and_on_failure(
        self,
        validator: DataFrameValidator,
        on_success_callback: TracksValidationCallbacks,
        on_failure_callback: TracksValidationCallbacks,
    ) -> None:
        def generate_data() -> Generator[DataFrame, None, None]:
            for i in range(0, 6, 3):
                yield pd.DataFrame({"id": [i + 1, i + 2, i + 3]})
            yield pd.DataFrame({"id": [None]})

        validator.run(generate_data(), on_success_callback, on_failure_callback)

        assert on_success_callback.times_called == 2
        assert on_failure_callback.times_called == 1
        assert pd.DataFrame({"id": [None]}).equals(on_failure_callback.calls[0][0])

    def test_it_aborts_on_failure(
        self,
        validator: DataFrameValidator,
        on_success_callback: TracksValidationCallbacks,
        on_failure_callback: TracksValidationCallbacks,
    ) -> None:
        def generate_data() -> Generator[DataFrame, None, None]:
            yield pd.DataFrame({"id": [None]})
            for i in range(0, 6, 3):
                yield pd.DataFrame({"id": [i + 1, i + 2, i + 3]})

        validator.run(generate_data(), on_success_callback, on_failure_callback)

        assert on_success_callback.was_called is False
        assert on_failure_callback.times_called == 1
        assert pd.DataFrame({"id": [None]}).equals(on_failure_callback.calls[0][0])

    def test_it_warns_when_using_tests_that_require_the_whole_table_or_column(
        self,
        validator: DataFrameValidator,
        on_success_callback: TracksValidationCallbacks,
        on_failure_callback: TracksValidationCallbacks,
    ) -> None:
        dfs = (pd.DataFrame({"id": [i + 1, i + 2, i + 3]}) for i in range(0, 9, 3))

        validator.add_tests(
            TableRowCountToBeBetween(min_count=1, max_count=10),
            ColumnValuesToBeUnique(column="id"),
        )

        expected_warning_match = (
            "The following tests could have unexpected results:\n\n"
            + "\t- columnValuesToBeUnique\n"
            + "\t- tableRowCountToBeBetween"
        )

        with pytest.warns(WholeTableTestsWarning, match=expected_warning_match):
            validator.run(dfs, on_success_callback, on_failure_callback)

    def test_run_returns_merged_validation_result(
        self,
        validator: DataFrameValidator,
        on_success_callback: TracksValidationCallbacks,
        on_failure_callback: TracksValidationCallbacks,
    ) -> None:
        dfs = (pd.DataFrame({"id": [i + 1, i + 2, i + 3]}) for i in range(0, 9, 3))

        result = validator.run(dfs, on_success_callback, on_failure_callback)

        assert isinstance(result, ValidationResult)
        assert result.success is True

    def test_merged_result_has_correct_aggregated_metrics(
        self,
        validator: DataFrameValidator,
        on_success_callback: TracksValidationCallbacks,
        on_failure_callback: TracksValidationCallbacks,
    ) -> None:
        dfs = [
            pd.DataFrame({"id": [1, 2, 3]}),
            pd.DataFrame({"id": [4, 5, 6]}),
            pd.DataFrame({"id": [7, 8, 9]}),
        ]

        result = validator.run(iter(dfs), on_success_callback, on_failure_callback)

        assert result.total_tests == 1
        assert result.passed_tests == 1
        assert result.failed_tests == 0
        assert result.success is True

    def test_merged_result_aggregates_failures_correctly(
        self,
        validator: DataFrameValidator,
        on_success_callback: TracksValidationCallbacks,
        on_failure_callback: TracksValidationCallbacks,
    ) -> None:
        dfs = [
            pd.DataFrame({"id": [1, 2, 3]}),
            pd.DataFrame({"id": [None]}),
        ]

        result = validator.run(iter(dfs), on_success_callback, on_failure_callback)

        assert result.total_tests == 1
        assert result.passed_tests == 0
        assert result.failed_tests == 1
        assert result.success is False

    def test_merged_result_contains_aggregated_test_case_results(
        self,
        validator: DataFrameValidator,
        on_success_callback: TracksValidationCallbacks,
        on_failure_callback: TracksValidationCallbacks,
    ) -> None:
        validator.add_test(ColumnValuesToBeUnique(column="id"))

        dfs = [
            pd.DataFrame({"id": [1, 2, 3]}),
            pd.DataFrame({"id": [4, 5, 6]}),
        ]

        with pytest.warns(WholeTableTestsWarning):
            result = validator.run(iter(dfs), on_success_callback, on_failure_callback)

        assert len(result.test_cases_and_results) == 2
        assert all(
            isinstance(test_case, TestCase) and isinstance(test_result, TestCaseResult)
            for test_case, test_result in result.test_cases_and_results
        )
        _, aggregated_not_null_result = result.test_cases_and_results[0]
        assert aggregated_not_null_result.passedRows == 6

    def test_merged_result_sums_execution_times(
        self,
        validator: DataFrameValidator,
        on_success_callback: TracksValidationCallbacks,
        on_failure_callback: TracksValidationCallbacks,
    ) -> None:
        dfs = [
            pd.DataFrame({"id": [1, 2, 3]}),
            pd.DataFrame({"id": [4, 5, 6]}),
            pd.DataFrame({"id": [7, 8, 9]}),
        ]

        result = validator.run(iter(dfs), on_success_callback, on_failure_callback)

        assert result.execution_time_ms > 0
        individual_times = [
            call[1].execution_time_ms for call in on_success_callback.calls
        ]
        assert result.execution_time_ms == sum(individual_times)

    def test_merged_result_with_mixed_success_and_failure(
        self,
        validator: DataFrameValidator,
        on_success_callback: TracksValidationCallbacks,
        on_failure_callback: TracksValidationCallbacks,
    ) -> None:
        def generate_mixed_data() -> Generator[DataFrame, None, None]:
            yield pd.DataFrame({"id": [1, 2, 3]})
            yield pd.DataFrame({"id": [4, 5, 6]})
            yield pd.DataFrame({"id": [None]})

        result = validator.run(
            generate_mixed_data(), on_success_callback, on_failure_callback
        )

        assert result.total_tests == 1
        assert result.passed_tests == 0
        assert result.failed_tests == 1
        assert result.success is False
        assert len(result.test_cases_and_results) == 1

    def test_merged_result_aggregates_multiple_tests_per_batch(
        self,
        on_success_callback: TracksValidationCallbacks,
        on_failure_callback: TracksValidationCallbacks,
    ) -> None:
        validator = DataFrameValidator(Mock())
        validator.add_tests(
            ColumnValuesToBeNotNull(column="id"),
            ColumnValuesToBeUnique(column="id"),
            TableRowCountToBeBetween(min_count=1, max_count=10),
        )

        dfs = [
            pd.DataFrame({"id": [1, 2, 3]}),
            pd.DataFrame({"id": [4, 5, 6]}),
        ]

        with pytest.warns(WholeTableTestsWarning):
            result = validator.run(iter(dfs), on_success_callback, on_failure_callback)

        assert result.total_tests == 3
        assert result.passed_tests == 3
        assert result.failed_tests == 0
        assert result.success is True

    def test_merged_result_with_short_circuit_on_failure(
        self,
        validator: DataFrameValidator,
        on_success_callback: TracksValidationCallbacks,
        on_failure_callback: TracksValidationCallbacks,
    ) -> None:
        def generate_data() -> Generator[DataFrame, None, None]:
            yield pd.DataFrame({"id": [None]})
            yield pd.DataFrame({"id": [1, 2, 3]})
            yield pd.DataFrame({"id": [4, 5, 6]})

        result = validator.run(
            generate_data(), on_success_callback, on_failure_callback
        )

        assert result.total_tests == 1
        assert result.passed_tests == 0
        assert result.failed_tests == 1
        assert result.success is False

    def test_merged_result_reflects_all_batches_processed(
        self,
        validator: DataFrameValidator,
        on_success_callback: TracksValidationCallbacks,
        on_failure_callback: TracksValidationCallbacks,
    ) -> None:
        batch_count = 5
        dfs = [
            pd.DataFrame({"id": [i + 1, i + 2, i + 3]})
            for i in range(0, batch_count * 3, 3)
        ]

        result = validator.run(iter(dfs), on_success_callback, on_failure_callback)

        assert result.total_tests == 1
        assert len(result.test_cases_and_results) == 1
        assert on_success_callback.times_called == batch_count
        _, aggregated_result = result.test_cases_and_results[0]
        assert aggregated_result.passedRows == batch_count * 3
