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

"""Chunked test executor for StreamingRunner.

This module provides functionality to execute a single test on DataFrame chunks,
processing data in memory-efficient chunks rather than loading the entire dataset.
"""

from typing import List, Set

from pandas import DataFrame

from metadata.data_quality.builders.validator_builder import ValidatorBuilder
from metadata.data_quality.interface.pandas.pandas_test_suite_interface import (
    PandasTestSuiteInterface,
)
from metadata.generated.schema.tests.basic import TestCaseResult
from metadata.generated.schema.tests.testCase import TestCase
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.sdk.data_quality.executor.result_aggregator import ResultAggregator
from metadata.sdk.data_quality.mocks.mock_entities import (
    MockDataFrameSampler,
    create_mock_datalake_connection,
    create_mock_table_entity,
)
from metadata.sdk.data_quality.models.validation_result import ChunkedTestResults


class ChunkedTestExecutor:
    """Executes a single test on DataFrame chunks.

    Processes a DataFrame in chunks to maintain constant memory usage,
    running the same test on each chunk and aggregating results.

    Attributes:
        client: OpenMetadata client for metadata operations
    """

    def __init__(self, client: OpenMetadata):
        """Initialize ChunkedTestExecutor.

        Args:
            client: OpenMetadata client for metadata operations
        """
        self.client = client

    def execute(
        self,
        test_case: TestCase,
        df: DataFrame,
        chunksize: int,
        mode: str = "short-circuit",
    ) -> ChunkedTestResults:
        """Execute test on DataFrame chunks.

        Splits DataFrame into chunks and runs test on each chunk sequentially.
        Aggregates results and tracks failed row indices per chunk.

        Args:
            test_case: TestCase to execute
            df: DataFrame to validate
            chunksize: Number of rows per chunk
            mode: "short-circuit" stops on first failure, "report-errors" continues

        Returns:
            ChunkedTestResults with aggregated result and per-chunk details
        """
        chunks = self._chunk_dataframe(df, chunksize)
        chunk_results: List[TestCaseResult] = []
        failed_indices_per_chunk: List[Set[int]] = []

        for chunk_idx, chunk_df in enumerate(chunks):
            interface = self._create_interface([chunk_df])
            result = interface.run_test_case(test_case)

            chunk_results.append(result)

            # Identify failed rows in this chunk
            failed_indices = ResultAggregator.identify_failed_rows(
                chunk_df, test_case, result
            )
            failed_indices_per_chunk.append(failed_indices)

            # Short-circuit mode: Stop on first failure
            if mode == "short-circuit" and result.testCaseStatus.value != "Success":
                break

        # Aggregate results across all processed chunks
        aggregated_result = ResultAggregator.aggregate_chunk_results(
            chunk_results, test_case
        )

        # Compute row counts from chunk sizes and failed indices
        total_rows = sum(len(chunk) for chunk in chunks[: len(chunk_results)])
        total_failed = sum(len(indices) for indices in failed_indices_per_chunk)
        total_passed = total_rows - total_failed

        # Update aggregated result with computed row counts
        if total_rows > 0:
            aggregated_result.passedRows = total_passed
            aggregated_result.failedRows = total_failed
            aggregated_result.passedRowsPercentage = (total_passed / total_rows) * 100
            aggregated_result.failedRowsPercentage = (total_failed / total_rows) * 100

        return ChunkedTestResults(
            test_case=test_case,
            aggregated_result=aggregated_result,
            failed_indices_per_chunk=failed_indices_per_chunk,
            chunk_results=chunk_results,
        )

    def _chunk_dataframe(self, df: DataFrame, chunksize: int) -> List[DataFrame]:
        """Split DataFrame into chunks of specified size.

        Args:
            df: DataFrame to split
            chunksize: Maximum number of rows per chunk

        Returns:
            List of DataFrame chunks
        """
        chunks = []
        num_rows = len(df)

        for start_idx in range(0, num_rows, chunksize):
            end_idx = min(start_idx + chunksize, num_rows)
            chunk = df.iloc[start_idx:end_idx].copy()
            chunks.append(chunk)

        return chunks

    def _create_interface(
        self, dataframes: List[DataFrame]
    ) -> PandasTestSuiteInterface:
        """Create PandasTestSuiteInterface with mock entities.

        Creates a test interface using mock entities (sampler, table, connection)
        to run tests on DataFrames without requiring real database connections.

        Args:
            dataframes: List of DataFrame chunks to test

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
