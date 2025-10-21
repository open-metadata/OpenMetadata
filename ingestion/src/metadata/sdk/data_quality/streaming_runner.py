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

"""Streaming DataFrame validator for OpenMetadata.

This module provides the main StreamingRunner class for validating large
DataFrames with constant memory usage by streaming through chunks.
"""

from typing import Iterator, List

from pandas import DataFrame

from metadata.generated.schema.tests.testCase import TestCase
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.sdk.data_quality.executor.parallel_executor import ParallelTestExecutor
from metadata.sdk.data_quality.models.validation_result import ValidationResult


class StreamingRunner:
    """Streaming DataFrame validator with constant memory usage.

    Validates DataFrames in chunks, running tests in parallel and yielding
    results as they complete. Supports both filtering (remove bad rows) and
    reporting (include error details) modes.

    Example:
        ```python
        from metadata.sdk.data_quality import StreamingRunner

        runner = StreamingRunner(ometa_client)

        for result in runner.validate(df, test_cases, chunksize=10000):
            if result.success:
                # Process clean data
                write_to_destination(result.df)
            else:
                # Handle validation errors
                log_errors(result.errors)
        ```

    Attributes:
        client: OpenMetadata client for metadata operations
        parallel_executor: Executor for running tests concurrently
    """

    def __init__(self, client: OpenMetadata):
        """Initialize StreamingRunner.

        Args:
            client: OpenMetadata client for metadata operations
        """
        self.client = client
        self.parallel_executor = ParallelTestExecutor(client)

    def validate(
        self,
        df: DataFrame,
        test_cases: List[TestCase],
        chunksize: int = 10000,
        mode: str = "filter",
        max_workers: int = 4,
    ) -> Iterator[ValidationResult]:
        """Validate DataFrame in chunks, yielding results as they complete.

        Streams through the DataFrame in chunks, executing tests in parallel
        on each chunk. Yields ValidationResult objects containing either clean
        data (filter mode) or all data with error details (report mode).

        Args:
            df: DataFrame to validate
            test_cases: List of TestCase objects to execute
            chunksize: Number of rows per chunk (controls memory usage)
            mode: "filter" to remove bad rows, "report" to include error details
            max_workers: Maximum number of concurrent test executions

        Yields:
            ValidationResult for each chunk with clean/error data

        Example:
            ```python
            # Filter mode: Only yield passing rows
            for result in runner.validate(df, tests, mode="filter"):
                if result.success:
                    print(f"Chunk {result.chunk_number}: {len(result.df)} clean rows")

            # Report mode: Include error details
            for result in runner.validate(df, tests, mode="report"):
                if not result.success:
                    print(f"Chunk {result.chunk_number}: {len(result.errors)} errors")
            ```
        """
        if not test_cases:
            # No tests to run - yield original data
            for chunk_number, chunk_df in enumerate(
                self._chunk_dataframe(df, chunksize)
            ):
                yield ValidationResult(
                    chunk_number=chunk_number,
                    success=True,
                    df=chunk_df,
                    errors=None,
                    error_summary=None,
                    test_results=[],
                )
            return

        # Process each chunk
        for chunk_number, chunk_df in enumerate(self._chunk_dataframe(df, chunksize)):
            # Execute all tests on this chunk in parallel
            test_results = self.parallel_executor.execute(
                test_cases=test_cases,
                df=chunk_df,
                chunksize=len(chunk_df),  # Don't re-chunk within parallel executor
                max_workers=max_workers,
                mode="report-errors",
            )

            # Identify all failed rows across all tests
            all_failed_indices = set()
            for result in test_results.values():
                if hasattr(result, "failed_indices_per_chunk"):
                    # ChunkedTestResults
                    for chunk_indices in result.failed_indices_per_chunk:
                        all_failed_indices.update(chunk_indices)
                else:
                    # FullTableTestResult
                    all_failed_indices.update(result.failed_indices)

            # Generate output based on mode
            # Convert test results to list for ValidationResult
            test_result_list = []
            for test_name, result in test_results.items():
                if hasattr(result, "aggregated_result"):
                    test_result_list.append(result.aggregated_result)
                else:
                    test_result_list.append(result.result)

            if mode == "filter":
                # Filter mode: Only return passing rows
                if all_failed_indices:
                    clean_df = chunk_df.drop(index=list(all_failed_indices))
                    error_summary = f"{len(all_failed_indices)} rows failed validation"
                    yield ValidationResult(
                        chunk_number=chunk_number,
                        success=len(all_failed_indices) == 0,
                        df=clean_df,
                        errors=None,
                        error_summary=error_summary,
                        test_results=test_result_list,
                    )
                else:
                    # All rows passed
                    yield ValidationResult(
                        chunk_number=chunk_number,
                        success=True,
                        df=chunk_df,
                        errors=None,
                        error_summary=None,
                        test_results=test_result_list,
                    )
            else:
                # Report mode: Return all rows with error details
                if all_failed_indices:
                    error_df = chunk_df.loc[list(all_failed_indices)]
                    error_summary = f"{len(all_failed_indices)} rows failed validation"
                    yield ValidationResult(
                        chunk_number=chunk_number,
                        success=False,
                        df=chunk_df,
                        errors=error_df,
                        error_summary=error_summary,
                        test_results=test_result_list,
                    )
                else:
                    # All rows passed
                    yield ValidationResult(
                        chunk_number=chunk_number,
                        success=True,
                        df=chunk_df,
                        errors=None,
                        error_summary=None,
                        test_results=test_result_list,
                    )

    def _chunk_dataframe(self, df: DataFrame, chunksize: int) -> Iterator[DataFrame]:
        """Split DataFrame into chunks for streaming.

        Args:
            df: DataFrame to chunk
            chunksize: Maximum rows per chunk

        Yields:
            DataFrame chunks
        """
        num_rows = len(df)
        for start_idx in range(0, num_rows, chunksize):
            end_idx = min(start_idx + chunksize, num_rows)
            yield df.iloc[start_idx:end_idx].copy()
