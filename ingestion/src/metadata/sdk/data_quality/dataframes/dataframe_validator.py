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

"""DataFrame validation API."""
import warnings
from typing import Callable, Iterable, List

from pandas import DataFrame

from metadata.sdk.data_quality.dataframes.custom_warnings import WholeTableTestsWarning
from metadata.sdk.data_quality.dataframes.dataframe_validation_engine import (
    DataFrameValidationEngine,
)
from metadata.sdk.data_quality.dataframes.validation_results import (
    FailureMode,
    ValidationResult,
)
from metadata.sdk.data_quality.dataframes.validators import requires_whole_table
from metadata.sdk.data_quality.tests.base_tests import BaseTest

ValidatorCallback = Callable[[DataFrame, ValidationResult], None]


class DataFrameValidator:
    """Facade for DataFrame data quality validation.

    Provides a simple interface to configure and execute data quality tests
    on pandas DataFrames using OpenMetadata test definitions.

    Example:
        validator = DataFrameValidator()
        validator.add_test(ColumnValuesToBeNotNull(column="email"))
        validator.add_test(ColumnValuesToBeUnique(column="customer_id"))

        result = validator.validate(df, mode=FailureMode.ShortCircuit)
        if not result.success:
            print(f"Validation failed: {result.failures}")
    """

    def __init__(self):
        self._test_definitions: List[BaseTest] = []

    def add_test(self, test: BaseTest) -> None:
        """Add a single test definition to be executed.

        Args:
            test: Test definition (e.g., ColumnValuesToBeNotNull)
        """
        self._test_definitions.append(test)

    def add_tests(self, *tests: BaseTest) -> None:
        """Add multiple test definitions at once.

        Args:
            *tests: Variable number of test definitions
        """
        self._test_definitions.extend(tests)

    def validate(
        self,
        df: DataFrame,
        mode: FailureMode = FailureMode.SHORT_CIRCUIT,
    ) -> ValidationResult:
        """Execute all configured tests on the DataFrame.

        Args:
            df: DataFrame to validate
            mode: Validation mode (`FailureMode.ShortCircuit` stops on first failure)

        Returns:
            ValidationResult with outcomes for all tests
        """

        test_case_definitions = [
            test.to_test_case_definition() for test in self._test_definitions
        ]

        engine = DataFrameValidationEngine(test_case_definitions)
        return engine.execute(df, mode)

    def _check_full_table_tests_included(self) -> None:
        test_names = {
            test.test_definition_name
            for test in self._test_definitions
            if requires_whole_table(test.test_definition_name)
        }

        if not test_names:
            return

        warnings.warn(
            WholeTableTestsWarning(
                "Running tests that require the whole table on chunks could lead to false positives. "
                + "For example, a DataFrame with 200 rows split in chunks of 50 could pass tests expecting "
                + "DataFrames to contain max 100 rows.\n\n"
                + "The following tests could have unexpected results:\n\n\t- "
                + "\n\t- ".join(sorted(test_names))
            )
        )

    def run(
        self,
        data: Iterable[DataFrame],
        on_success: ValidatorCallback,
        on_failure: ValidatorCallback,
        mode: FailureMode = FailureMode.SHORT_CIRCUIT,
    ) -> None:
        """Execute all configured tests on the DataFrame and call callbacks.

        Useful for running validation based on chunks, for example:

        ```python
        validator = DataFrameValidator()
        validator.add_test(ColumnValuesToBeNotNull(column="email"))

        def load_df_to_destination(df, result):
            ...

        def rollback(df, result):
            "Clears data previously loaded"
            ...

        validator.run(
            pandas.read_csv('somefile.csv', chunksize=1000),
            on_success=load_df_to_destination,
            on_failure=rollback,
            mode=FailureMode.SHORT_CIRCUIT,
        )
        ```

        Args:
            data: An iterable of pandas DataFrames
            on_success: Callback to execute after successful validation
            on_failure: Callback to execute after failed validation
            mode: Validation mode (`FailureMode.ShortCircuit` stops on first failure)

        Returns:
            None
        """
        self._check_full_table_tests_included()

        for df in data:
            validation_result = self.validate(df, mode)

            if validation_result.success:
                on_success(df, validation_result)
            else:
                on_failure(df, validation_result)

                if mode is FailureMode.SHORT_CIRCUIT:
                    break
