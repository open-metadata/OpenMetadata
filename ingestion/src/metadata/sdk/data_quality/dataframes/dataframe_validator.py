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
from typing import Any, Callable, Iterable, List, Optional, cast, final

from pandas import DataFrame

from metadata.generated.schema.tests.testCase import TestCase
from metadata.ingestion.ometa.ometa_api import OpenMetadata as OMeta
from metadata.sdk import OpenMetadata
from metadata.sdk import client as get_client
from metadata.sdk.data_quality.dataframes.custom_warnings import WholeTableTestsWarning
from metadata.sdk.data_quality.dataframes.dataframe_validation_engine import (
    DataFrameValidationEngine,
)
from metadata.sdk.data_quality.dataframes.models import create_mock_test_case
from metadata.sdk.data_quality.dataframes.validation_results import (
    FailureMode,
    ValidationResult,
)
from metadata.sdk.data_quality.dataframes.validators import requires_whole_table
from metadata.sdk.data_quality.tests.base_tests import BaseTest

ValidatorCallback = Callable[[DataFrame, ValidationResult], None]


@final
class DataFrameValidator:
    """Facade for DataFrame data quality validation.

    Provides a simple interface to configure and execute data quality tests
    on pandas DataFrames using OpenMetadata test definitions.

    Examples:
        validator = DataFrameValidator()
        validator.add_test(ColumnValuesToBeNotNull(column="email"))
        validator.add_test(ColumnValuesToBeUnique(column="customer_id"))

        result = validator.validate(df, mode=FailureMode.ShortCircuit)
        if not result.success:
            print(f"Validation failed: {result.failures}")
    """

    def __init__(
        self,
        client: Optional[  # pyright: ignore[reportRedeclaration]
            OMeta[Any, Any]
        ] = None,
    ):
        self._test_cases: List[TestCase] = []

        if client is None:
            metadata: OpenMetadata = get_client()
            client: OMeta[Any, Any] = metadata.ometa

        self._client = client

    def add_test(self, test: BaseTest) -> None:
        """Add a single test definition to be executed.

        Args:
            test: Test definition (e.g., ColumnValuesToBeNotNull)
        """
        self._test_cases.append(create_mock_test_case(test))

    def add_tests(self, *tests: BaseTest) -> None:
        """Add multiple test definitions at once.

        Args:
            *tests: Variable number of test definitions
        """
        self._test_cases.extend(create_mock_test_case(t) for t in tests)

    def add_openmetadata_test(self, test_fqn: str) -> None:
        test_case = cast(
            TestCase,
            self._client.get_by_name(
                TestCase,
                test_fqn,
                fields=["testDefinition", "testSuite"],
                nullable=False,
            ),
        )

        self._test_cases.append(test_case)

    def add_openmetadata_table_tests(self, table_fqn: str) -> None:
        test_suite = self._client.get_executable_test_suite(table_fqn)

        if test_suite is None:
            raise ValueError(f"Table {table_fqn!r} does not have a test suite to run")

        for test in test_suite.tests or []:
            assert test.fullyQualifiedName is not None
            self.add_openmetadata_test(test.fullyQualifiedName)

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
        engine = DataFrameValidationEngine(self._test_cases)
        return engine.execute(df, mode)

    def _check_full_table_tests_included(self) -> None:
        test_names: set[str] = {  # pyright: ignore[reportAssignmentType]
            test.testDefinition.fullyQualifiedName
            for test in self._test_cases
            if requires_whole_table(
                test.testDefinition.fullyQualifiedName  # pyright: ignore[reportArgumentType]
            )
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
    ) -> ValidationResult:
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

        result = validator.run(
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
            Merged ValidationResult aggregating all batch validations
        """
        self._check_full_table_tests_included()

        results: List[ValidationResult] = []

        for df in data:
            validation_result = self.validate(df, mode)
            results.append(validation_result)

            if validation_result.success:
                on_success(df, validation_result)
            else:
                on_failure(df, validation_result)

                if mode is FailureMode.SHORT_CIRCUIT:
                    break

        return ValidationResult.merge(*results)
