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

"""Data models for validation results in StreamingRunner."""

from dataclasses import dataclass
from typing import List, Optional, Set

from pandas import DataFrame

from metadata.data_quality.api.models import TestCaseResultResponse
from metadata.generated.schema.tests.basic import TestCaseResult
from metadata.generated.schema.tests.testCase import TestCase


@dataclass(frozen=True)
class ValidationResult:
    """Result of validating a single DataFrame chunk.

    Yielded by StreamingRunner.validate() for each chunk processed.
    Contains both clean and failed rows along with test results.
    """

    chunk_number: int
    success: bool
    df: DataFrame
    errors: Optional[DataFrame]
    error_summary: Optional[str]
    test_results: List[TestCaseResultResponse]

    @classmethod
    def from_chunk_results(
        cls,
        chunk_number: int,
        chunk_df: DataFrame,
        test_results: List[TestCaseResultResponse],
        failed_indices: Set[int],
        mode: str,
    ) -> "ValidationResult":
        """Build ValidationResult from test results and failed indices.

        Args:
            chunk_number: Chunk index (0-based)
            chunk_df: Original chunk DataFrame
            test_results: Results from all tests for this chunk
            failed_indices: Set of indices (within chunk) that failed validation
            mode: "short-circuit" or "report-errors"

        Returns:
            ValidationResult with split clean/error DataFrames
        """
        success = all(
            result.testCaseResult.testCaseStatus.value == "Success"
            for result in test_results
        )

        if mode == "report-errors" and failed_indices:
            clean_df = chunk_df[~chunk_df.index.isin(failed_indices)].copy()
            errors_df = chunk_df[chunk_df.index.isin(failed_indices)].copy()

            error_messages = {}
            for result in test_results:
                if result.testCaseResult.testCaseStatus.value != "Success":
                    test_name = str(result.testCase.name)
                    error_messages[test_name] = result.testCaseResult.result

            if error_messages:
                errors_df["_validation_error"] = errors_df.index.map(
                    lambda idx: "; ".join(
                        f"{name}: {msg}" for name, msg in error_messages.items()
                    )
                )
            error_summary = (
                None if success else f"Found {len(failed_indices)} failed rows"
            )
        elif not success:
            clean_df = DataFrame(columns=chunk_df.columns)
            errors_df = chunk_df.copy()
            failed_tests = [
                str(result.testCase.name)
                for result in test_results
                if result.testCaseResult.testCaseStatus.value != "Success"
            ]
            error_summary = f"Tests failed: {', '.join(failed_tests)}"
        else:
            clean_df = chunk_df.copy()
            errors_df = None
            error_summary = None

        if not success and mode == "short-circuit":
            error_summary = error_summary or "Validation failed in short-circuit mode"

        return cls(
            chunk_number=chunk_number,
            success=success,
            df=clean_df,
            errors=errors_df,
            error_summary=error_summary,
            test_results=test_results,
        )


@dataclass(frozen=True)
class ChunkedTestResults:
    """Results from executing a chunked test across all chunks.

    Internal model used by executors to track results across chunks.
    """

    test_case: TestCase
    aggregated_result: TestCaseResult
    failed_indices_per_chunk: List[Set[int]]
    chunk_results: List[TestCaseResult]


@dataclass(frozen=True)
class FullTableTestResult:
    """Result from executing a full-table test.

    Internal model used by executors.
    """

    test_case: TestCase
    result: TestCaseResult
    failed_indices: Set[int]
