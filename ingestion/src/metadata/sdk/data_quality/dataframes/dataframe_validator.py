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

from enum import Enum
from typing import List

from pandas import DataFrame

from metadata.sdk.data_quality.dataframes.validation_results import ValidationResult
from metadata.sdk.data_quality.tests.base_tests import BaseTest


class FailureMode(Enum):
    ShortCircuit = "short-circuit"


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
        mode: FailureMode = FailureMode.ShortCircuit,
    ) -> ValidationResult:
        """Execute all configured tests on the DataFrame.

        Args:
            df: DataFrame to validate
            mode: Validation mode (`FailureMode.ShortCircuit` stops on first failure)

        Returns:
            ValidationResult with outcomes for all tests
        """
        from metadata.sdk.data_quality.dataframes.dataframe_validation_engine import (
            DataFrameValidationEngine,
        )

        test_case_definitions = [
            test.to_test_case_definition() for test in self._test_definitions
        ]

        engine = DataFrameValidationEngine(test_case_definitions)
        return engine.execute(df, mode)
