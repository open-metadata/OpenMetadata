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

"""Result aggregation logic for StreamingRunner.

This module provides functionality to aggregate test results across DataFrame chunks,
handle validator-specific value aggregation, and identify failed rows.
"""

from typing import List, Optional, Set

from pandas import DataFrame

from metadata.data_quality.api.models import TestCaseDefinition
from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.generated.schema.tests.testCase import TestCase


class ResultAggregator:
    """Aggregates test results across DataFrame chunks.

    Provides methods to combine multiple TestCaseResult objects from chunked
    execution into a single aggregated result, with validator-specific logic
    for aggregating test result values.
    """

    @staticmethod
    def aggregate_chunk_results(
        chunk_results: List[TestCaseResult],
        test_case: TestCase,
        test_definition: Optional[TestCaseDefinition] = None,
    ) -> TestCaseResult:
        """Aggregate multiple chunk results into a single result.

        Combines results from processing multiple DataFrame chunks, summing
        row counts and recomputing percentages based on totals.

        Args:
            chunk_results: List of TestCaseResult objects from each chunk
            test_case: TestCase being executed
            test_definition: Optional TestCaseDefinition for metadata

        Returns:
            Aggregated TestCaseResult combining all chunk results
        """
        if not chunk_results:
            return TestCaseResult(
                timestamp=0,
                testCaseStatus=TestCaseStatus.Aborted,
                result="No chunk results to aggregate",
            )

        overall_status = (
            TestCaseStatus.Success
            if all(r.testCaseStatus == TestCaseStatus.Success for r in chunk_results)
            else TestCaseStatus.Failed
        )

        total_passed_rows = sum(
            r.passedRows or 0 for r in chunk_results if r.passedRows is not None
        )
        total_failed_rows = sum(
            r.failedRows or 0 for r in chunk_results if r.failedRows is not None
        )
        total_rows = total_passed_rows + total_failed_rows

        passed_rows_percentage = (
            (total_passed_rows / total_rows * 100) if total_rows > 0 else None
        )
        failed_rows_percentage = (
            (total_failed_rows / total_rows * 100) if total_rows > 0 else None
        )

        aggregated_result_values = ResultAggregator._aggregate_test_result_values(
            chunk_results, test_case, test_definition
        )

        first_result = chunk_results[0]
        result_message = (
            f"Aggregated from {len(chunk_results)} chunks: "
            f"{total_passed_rows} passed, {total_failed_rows} failed"
        )

        return TestCaseResult(
            timestamp=first_result.timestamp,
            testCaseStatus=overall_status,
            result=result_message,
            testResultValue=aggregated_result_values,
            passedRows=total_passed_rows if total_rows > 0 else None,
            failedRows=total_failed_rows if total_rows > 0 else None,
            passedRowsPercentage=passed_rows_percentage,
            failedRowsPercentage=failed_rows_percentage,
            minBound=first_result.minBound,
            maxBound=first_result.maxBound,
        )

    @staticmethod
    def _aggregate_test_result_values(
        chunk_results: List[TestCaseResult],
        test_case: TestCase,
        test_definition: Optional[TestCaseDefinition] = None,
    ) -> Optional[List[TestResultValue]]:
        """Aggregate test result values based on validator type.

        Different validators require different aggregation strategies:
        - Count-based: Sum values across chunks
        - Range checks: Keep individual chunk results or return first failure
        - Regex/pattern: Sum match counts
        - Table-level: Use first chunk or aggregate

        Args:
            chunk_results: List of TestCaseResult objects from each chunk
            test_case: TestCase being executed
            test_definition: Optional TestCaseDefinition for test type info

        Returns:
            List of aggregated TestResultValue objects, or None
        """
        if not chunk_results or not chunk_results[0].testResultValue:
            return None

        test_type = (
            str(test_case.testDefinition.name)
            if hasattr(test_case.testDefinition, "name")
            else str(test_case.testDefinition.fullyQualifiedName).split(".")[-1]
        )

        # Count-based validators: Sum values
        if test_type in [
            "columnValuesToBeNotNull",
            "columnValuesMissingCount",
            "tableRowCountToBeBetween",
            "tableRowCountToEqual",
        ]:
            total_value = sum(
                int(r.testResultValue[0].value)
                for r in chunk_results
                if r.testResultValue
            )
            return [TestResultValue(name=test_type, value=str(total_value))]

        # Range checks: Return aggregate stats or first failure
        if test_type in ["columnValuesToBeBetween", "columnValueLengthsToBeBetween"]:
            if all(r.testCaseStatus == TestCaseStatus.Success for r in chunk_results):
                return [
                    TestResultValue(
                        name=test_type,
                        value=f"All {len(chunk_results)} chunks passed",
                    )
                ]
            else:
                failed_chunk = next(
                    r
                    for r in chunk_results
                    if r.testCaseStatus == TestCaseStatus.Failed
                )
                return failed_chunk.testResultValue

        # Regex/pattern validators: Sum match counts
        if test_type in [
            "columnValuesToMatchRegex",
            "columnValuesToNotMatchRegex",
            "columnValuesToBeInSet",
            "columnValuesToBeNotInSet",
        ]:
            if chunk_results[0].testResultValue:
                try:
                    total_matches = sum(
                        int(r.testResultValue[0].value)
                        for r in chunk_results
                        if r.testResultValue
                    )
                    return [TestResultValue(name=test_type, value=str(total_matches))]
                except (ValueError, IndexError):
                    return chunk_results[0].testResultValue

        # Table-level validators
        if test_type.startswith("table"):
            if test_type in ["tableRowCountToBeBetween", "tableRowCountToEqual"]:
                total_rows = sum(
                    int(r.testResultValue[0].value)
                    for r in chunk_results
                    if r.testResultValue
                )
                return [TestResultValue(name=test_type, value=str(total_rows))]
            else:
                # Table column counts, etc. - same across chunks
                return chunk_results[0].testResultValue

        # Default: Return first chunk's values
        return chunk_results[0].testResultValue

    @staticmethod
    def identify_failed_rows(
        chunk_df: DataFrame,
        test_case: TestCase,
        result: TestCaseResult,
    ) -> Set[int]:
        """Identify which rows in the chunk failed validation.

        Uses validator-specific logic to determine which rows caused the
        test failure. Different validators expose failures differently.

        Args:
            chunk_df: DataFrame chunk being validated
            test_case: TestCase being executed
            result: TestCaseResult with failure information

        Returns:
            Set of row indices (within chunk) that failed validation
        """
        if result.testCaseStatus == TestCaseStatus.Success:
            return set()

        test_type = (
            str(test_case.testDefinition.name)
            if hasattr(test_case.testDefinition, "name")
            else str(test_case.testDefinition.fullyQualifiedName).split(".")[-1]
        )

        column_name = ResultAggregator._extract_column_name(test_case)
        if not column_name or column_name not in chunk_df.columns:
            return set()

        # NotNull validator
        if test_type == "columnValuesToBeNotNull":
            failed_mask = chunk_df[column_name].isna()
            return set(chunk_df[failed_mask].index)

        # Between validator
        if test_type == "columnValuesToBeBetween":
            min_val, max_val = ResultAggregator._extract_min_max_bounds(test_case)
            if min_val is not None and max_val is not None:
                failed_mask = ~chunk_df[column_name].between(min_val, max_val)
                return set(chunk_df[failed_mask].index)

        # Regex validator
        if test_type in ["columnValuesToMatchRegex", "columnValuesToNotMatchRegex"]:
            pattern = ResultAggregator._extract_regex_pattern(test_case)
            if pattern:
                matches = chunk_df[column_name].astype(str).str.match(pattern)
                if test_type == "columnValuesToMatchRegex":
                    failed_mask = ~matches
                else:
                    failed_mask = matches
                return set(chunk_df[failed_mask].index)

        # Length validator
        if test_type == "columnValueLengthsToBeBetween":
            min_len, max_len = ResultAggregator._extract_min_max_bounds(test_case)
            if min_len is not None and max_len is not None:
                lengths = chunk_df[column_name].astype(str).str.len()
                failed_mask = ~lengths.between(min_len, max_len)
                return set(chunk_df[failed_mask].index)

        # InSet validator
        if test_type == "columnValuesToBeInSet":
            allowed_values = ResultAggregator._extract_allowed_values(test_case)
            if allowed_values:
                failed_mask = ~chunk_df[column_name].isin(allowed_values)
                return set(chunk_df[failed_mask].index)

        # NotInSet validator
        if test_type == "columnValuesToBeNotInSet":
            forbidden_values = ResultAggregator._extract_forbidden_values(test_case)
            if forbidden_values:
                failed_mask = chunk_df[column_name].isin(forbidden_values)
                return set(chunk_df[failed_mask].index)

        # Fallback: Can't identify specific rows
        return set()

    @staticmethod
    def _extract_column_name(test_case: TestCase) -> Optional[str]:
        """Extract column name from test case entity link."""
        if not test_case.entityLink:
            return None

        # EntityLink is a RootModel, access the root attribute
        entity_link = (
            test_case.entityLink.root
            if hasattr(test_case.entityLink, "root")
            else str(test_case.entityLink)
        )
        if "::columns::" in entity_link:
            return entity_link.split("::columns::")[-1].rstrip(">")

        return None

    @staticmethod
    def _extract_min_max_bounds(test_case: TestCase) -> tuple:
        """Extract min and max bounds from test case parameters."""
        if not test_case.parameterValues:
            return None, None

        min_val = None
        max_val = None

        for param in test_case.parameterValues:
            param_name = str(param.name)
            if param_name in ["minValue", "minValueForMeanInCol", "minLength"]:
                try:
                    min_val = float(param.value) if param.value else None
                except (ValueError, TypeError):
                    pass
            elif param_name in ["maxValue", "maxValueForMeanInCol", "maxLength"]:
                try:
                    max_val = float(param.value) if param.value else None
                except (ValueError, TypeError):
                    pass

        return min_val, max_val

    @staticmethod
    def _extract_regex_pattern(test_case: TestCase) -> Optional[str]:
        """Extract regex pattern from test case parameters."""
        if not test_case.parameterValues:
            return None

        for param in test_case.parameterValues:
            if str(param.name) == "regex":
                return param.value

        return None

    @staticmethod
    def _extract_allowed_values(test_case: TestCase) -> Optional[List]:
        """Extract allowed values from test case parameters."""
        if not test_case.parameterValues:
            return None

        for param in test_case.parameterValues:
            if str(param.name) == "allowedValues":
                if param.value:
                    # Value might be a comma-separated string or list
                    if isinstance(param.value, str):
                        return [v.strip() for v in param.value.split(",")]
                    return param.value

        return None

    @staticmethod
    def _extract_forbidden_values(test_case: TestCase) -> Optional[List]:
        """Extract forbidden values from test case parameters."""
        if not test_case.parameterValues:
            return None

        for param in test_case.parameterValues:
            if str(param.name) == "forbiddenValues":
                if param.value:
                    # Value might be a comma-separated string or list
                    if isinstance(param.value, str):
                        return [v.strip() for v in param.value.split(",")]
                    return param.value

        return None
