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

"""Parallel test executor for StreamingRunner.

This module provides functionality to execute multiple tests concurrently
using ThreadPoolExecutor, with automatic classification of tests into
chunked vs full-table execution modes.
"""

from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Union

from pandas import DataFrame

from metadata.generated.schema.tests.testCase import TestCase
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.sdk.data_quality.executor.chunked_executor import ChunkedTestExecutor
from metadata.sdk.data_quality.executor.full_table_executor import FullTableTestExecutor
from metadata.sdk.data_quality.executor.validator_classification import (
    VALIDATOR_EXECUTION_MODE,
    ValidatorExecutionMode,
)
from metadata.sdk.data_quality.models.validation_result import (
    ChunkedTestResults,
    FullTableTestResult,
)


class ParallelTestExecutor:
    """Executes multiple tests concurrently on a DataFrame.

    Uses ThreadPoolExecutor to run tests in parallel, automatically
    classifying each test as chunked or full-table based on the validator type.

    Attributes:
        client: OpenMetadata client for metadata operations
        chunked_executor: Executor for chunked tests
        full_table_executor: Executor for full-table tests
    """

    def __init__(self, client: OpenMetadata):
        """Initialize ParallelTestExecutor.

        Args:
            client: OpenMetadata client for metadata operations
        """
        self.client = client
        self.chunked_executor = ChunkedTestExecutor(client)
        self.full_table_executor = FullTableTestExecutor(client)

    def execute(
        self,
        test_cases: List[TestCase],
        df: DataFrame,
        chunksize: int = 10000,
        max_workers: int = 4,
        mode: str = "report-errors",
    ) -> Dict[str, Union[ChunkedTestResults, FullTableTestResult]]:
        """Execute multiple tests in parallel.

        Classifies tests, executes them concurrently, and aggregates results.

        Args:
            test_cases: List of TestCase objects to execute
            df: DataFrame to validate
            chunksize: Number of rows per chunk for chunked tests
            max_workers: Maximum number of concurrent threads
            mode: Execution mode for chunked tests ("short-circuit" or "report-errors")

        Returns:
            Dictionary mapping test case names to test results
        """
        results: Dict[str, Union[ChunkedTestResults, FullTableTestResult]] = {}

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all test executions
            future_to_test = {}
            for test_case in test_cases:
                future = executor.submit(
                    self._execute_single_test, test_case, df, chunksize, mode
                )
                future_to_test[future] = test_case

            # Collect results as they complete
            for future in as_completed(future_to_test):
                test_case = future_to_test[future]
                # Extract actual string from TestCaseEntityName RootModel
                test_name = (
                    test_case.name.root
                    if hasattr(test_case.name, "root")
                    else str(test_case.name)
                )

                try:
                    result = future.result()
                    results[test_name] = result
                except Exception as exc:
                    # Log exception but continue with other tests
                    print(f"Error executing test {test_name}: {exc}")
                    # Could store error result if needed
                    continue

        return results

    def _execute_single_test(
        self,
        test_case: TestCase,
        df: DataFrame,
        chunksize: int,
        mode: str,
    ) -> Union[ChunkedTestResults, FullTableTestResult]:
        """Execute a single test with appropriate executor.

        Classifies the test and delegates to either ChunkedTestExecutor
        or FullTableTestExecutor based on the validator type.

        Args:
            test_case: TestCase to execute
            df: DataFrame to validate
            chunksize: Number of rows per chunk
            mode: Execution mode ("short-circuit" or "report-errors")

        Returns:
            ChunkedTestResults or FullTableTestResult with test results
        """
        execution_mode = self._classify_test(test_case)

        if execution_mode == ValidatorExecutionMode.CHUNKED:
            return self.chunked_executor.execute(
                test_case=test_case,
                df=df,
                chunksize=chunksize,
                mode=mode,
            )
        else:
            return self.full_table_executor.execute(
                test_case=test_case,
                df=df,
            )

    def _classify_test(self, test_case: TestCase) -> ValidatorExecutionMode:
        """Classify test as CHUNKED or FULL_TABLE.

        Args:
            test_case: TestCase to classify

        Returns:
            ValidatorExecutionMode indicating execution strategy
        """
        # Extract validator name from testDefinition
        validator_name = (
            str(test_case.testDefinition.name)
            if hasattr(test_case.testDefinition, "name")
            else str(test_case.testDefinition.fullyQualifiedName).split(".")[-1]
        )

        # Lookup in classification mapping
        return VALIDATOR_EXECUTION_MODE.get(
            validator_name, ValidatorExecutionMode.FULL_TABLE
        )
