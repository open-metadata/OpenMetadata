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

"""Full-table test executor for StreamingRunner.

This module provides functionality to execute tests that require the entire
DataFrame at once, such as uniqueness checks or table-level validations.
"""

from typing import List

from pandas import DataFrame

from metadata.data_quality.builders.validator_builder import ValidatorBuilder
from metadata.data_quality.interface.pandas.pandas_test_suite_interface import (
    PandasTestSuiteInterface,
)
from metadata.generated.schema.tests.testCase import TestCase
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.sdk.data_quality.mocks.mock_entities import (
    MockDataFrameSampler,
    create_mock_datalake_connection,
    create_mock_table_entity,
)
from metadata.sdk.data_quality.models.validation_result import FullTableTestResult


class FullTableTestExecutor:
    """Executes a single test on the entire DataFrame.

    For validators that require full dataset access (uniqueness, distinct
    counts, etc.), this executor runs the test once on the complete DataFrame.

    Attributes:
        client: OpenMetadata client for metadata operations
    """

    def __init__(self, client: OpenMetadata):
        """Initialize FullTableTestExecutor.

        Args:
            client: OpenMetadata client for metadata operations
        """
        self.client = client

    def execute(
        self,
        test_case: TestCase,
        df: DataFrame,
    ) -> FullTableTestResult:
        """Execute test on entire DataFrame.

        Runs the validator once on the full dataset and returns the result.

        Args:
            test_case: TestCase to execute
            df: Complete DataFrame to validate

        Returns:
            FullTableTestResult with test result and failed row indices
        """
        from metadata.sdk.data_quality.executor.result_aggregator import (
            ResultAggregator,
        )

        interface = self._create_interface([df])
        result = interface.run_test_case(test_case)

        # Identify failed rows
        failed_indices = ResultAggregator.identify_failed_rows(df, test_case, result)

        return FullTableTestResult(
            test_case=test_case,
            result=result,
            failed_indices=failed_indices,
        )

    def _create_interface(
        self, dataframes: List[DataFrame]
    ) -> PandasTestSuiteInterface:
        """Create PandasTestSuiteInterface with mock entities.

        Creates a test interface using mock entities (sampler, table, connection)
        to run tests on DataFrames without requiring real database connections.

        Args:
            dataframes: List containing the full DataFrame

        Returns:
            PandasTestSuiteInterface configured for DataFrame validation
        """
        sampler = MockDataFrameSampler(dataframes)
        table_entity = create_mock_table_entity()
        connection = create_mock_datalake_connection()

        interface = PandasTestSuiteInterface(
            service_connection_config=connection,
            ometa_client=self.client,
            sampler=sampler,
            table_entity=table_entity,
            validator_builder=ValidatorBuilder,
        )

        return interface
