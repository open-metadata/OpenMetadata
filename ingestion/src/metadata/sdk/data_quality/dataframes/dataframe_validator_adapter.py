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

"""Adapter to wrap existing validators for DataFrame validation."""

from datetime import datetime
from typing import List, Optional, Type
from uuid import uuid4

from pandas import DataFrame

from metadata.data_quality.api.models import TestCaseDefinition
from metadata.data_quality.validations.base_test_handler import BaseTestValidator
from metadata.data_quality.validations.column.pandas import (
    ColumnValueLengthsToBeBetweenValidator,
    ColumnValueMaxToBeBetweenValidator,
    ColumnValueMeanToBeBetweenValidator,
    ColumnValueMedianToBeBetweenValidator,
    ColumnValueMinToBeBetweenValidator,
    ColumnValuesMissingCountValidator,
    ColumnValuesSumToBeBetweenValidator,
    ColumnValueStdDevToBeBetweenValidator,
    ColumnValuesToBeAtExpectedLocationValidator,
    ColumnValuesToBeBetweenValidator,
    ColumnValuesToBeInSetValidator,
    ColumnValuesToBeNotInSetValidator,
    ColumnValuesToBeNotNullValidator,
    ColumnValuesToBeUniqueValidator,
    ColumnValuesToMatchRegexValidator,
    ColumnValuesToNotMatchRegexValidator,
)
from metadata.data_quality.validations.table.pandas import (
    TableColumnCountToBeBetweenValidator,
    TableColumnCountToEqualValidator,
    TableColumnNameToExistValidator,
    TableColumnToMatchSetValidator,
    TableRowCountToBeBetweenValidator,
    TableRowCountToEqualValidator,
)
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.type.basic import Timestamp
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.sdk.data_quality.dataframes.validation_results import TestValidationResult

VALIDATOR_REGISTRY = {
    "columnValuesToBeNotNull": ColumnValuesToBeNotNullValidator,
    "columnValuesToBeUnique": ColumnValuesToBeUniqueValidator,
    "columnValuesToBeBetween": ColumnValuesToBeBetweenValidator,
    "columnValuesToBeInSet": ColumnValuesToBeInSetValidator,
    "columnValuesToBeNotInSet": ColumnValuesToBeNotInSetValidator,
    "columnValuesToMatchRegex": ColumnValuesToMatchRegexValidator,
    "columnValuesToNotMatchRegex": ColumnValuesToNotMatchRegexValidator,
    "columnValueLengthsToBeBetween": ColumnValueLengthsToBeBetweenValidator,
    "columnValueMaxToBeBetween": ColumnValueMaxToBeBetweenValidator,
    "columnValueMeanToBeBetween": ColumnValueMeanToBeBetweenValidator,
    "columnValueMedianToBeBetween": ColumnValueMedianToBeBetweenValidator,
    "columnValueMinToBeBetween": ColumnValueMinToBeBetweenValidator,
    "columnValueStdDevToBeBetween": ColumnValueStdDevToBeBetweenValidator,
    "columnValuesSumToBeBetween": ColumnValuesSumToBeBetweenValidator,
    "columnValuesMissingCount": ColumnValuesMissingCountValidator,
    "columnValuesToBeAtExpectedLocation": ColumnValuesToBeAtExpectedLocationValidator,
    "tableRowCountToBeBetween": TableRowCountToBeBetweenValidator,
    "tableRowCountToEqual": TableRowCountToEqualValidator,
    "tableColumnCountToBeBetween": TableColumnCountToBeBetweenValidator,
    "tableColumnCountToEqual": TableColumnCountToEqualValidator,
    "tableColumnNameToExist": TableColumnNameToExistValidator,
    "tableColumnToMatchSet": TableColumnToMatchSetValidator,
}


class DataFrameValidatorAdapter:
    """Adapter to translate DataFrame validation to existing validator interface."""

    def __init__(
        self,
        df: DataFrame,
        test_definition: TestCaseDefinition,
    ):
        self.df: DataFrame = df
        self.test_definition: TestCaseDefinition = test_definition

    def run_validation(self) -> TestValidationResult:
        """Execute validation and return structured result.

        Returns:
            TestValidationResult with validation outcome
        """
        test_case = self._create_test_case()
        validator_class = self._get_validator_class()
        wrapped_df = self._wrap_dataframe()

        validator = validator_class(
            runner=wrapped_df,
            test_case=test_case,
            execution_date=Timestamp(int(datetime.now().timestamp() * 1000)),
        )

        test_case_result = validator.run_validation()
        failed_indices = self._extract_failed_indices(test_case_result)

        return TestValidationResult(
            test_name=str(test_case.name),
            test_type=self.test_definition.testDefinitionName,
            status=test_case_result.testCaseStatus or TestCaseStatus.Aborted,
            passed_rows=test_case_result.passedRows or 0,
            failed_rows=test_case_result.failedRows or 0,
            total_rows=len(self.df),
            failed_row_indices=failed_indices,
            result_message=test_case_result.result or "",
            test_case_result=test_case_result,
        )

    def _create_test_case(self) -> TestCase:
        """Convert TestCaseDefinition to TestCase object.

        Returns:
            Synthetic TestCase for DataFrame validation
        """
        column_name = self.test_definition.columnName

        entity_link = "<#E::table::dataframe_validation>"
        if column_name:
            entity_link = f"<#E::table::dataframe_validation::columns::{column_name}>"

        return TestCase(  # pyright: ignore[reportCallIssue]
            id=uuid4(),
            name=self.test_definition.name,
            displayName=self.test_definition.displayName,
            description=self.test_definition.description,
            testDefinition=EntityReference(  # pyright: ignore[reportCallIssue]
                id=uuid4(),
                name=self.test_definition.testDefinitionName,
                type="testDefinition",
            ),
            entityLink=entity_link,
            parameterValues=self.test_definition.parameterValues,
            testSuite=EntityReference(  # pyright: ignore[reportCallIssue]
                id=uuid4(),
                name="dataframe_validation",
                type="testSuite",
            ),
            computePassedFailedRowCount=True,
        )

    def _get_validator_class(self) -> Type[BaseTestValidator]:
        """Resolve validator class from test definition name.

        Returns:
            Validator class for the test definition

        Raises:
            ValueError: If test definition is not supported
        """
        validator_class = VALIDATOR_REGISTRY.get(
            self.test_definition.testDefinitionName
        )
        if not validator_class:
            raise ValueError(
                f"Unknown test definition: {self.test_definition.testDefinitionName}"
            )

        return validator_class

    def _wrap_dataframe(self) -> List[DataFrame]:
        """Wrap DataFrame in format expected by pandas validators.

        Returns:
            DataFrame wrapped in list as expected by validators
        """
        return [self.df]

    def _extract_failed_indices(
        self, _test_result: TestCaseResult
    ) -> Optional[List[int]]:
        """Extract indices of rows that failed validation.

        Args:
            _test_result: Result from validator execution

        Returns:
            None (row-level tracking not implemented yet)
        """
        return None
