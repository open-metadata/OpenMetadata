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
import logging
from datetime import datetime
from typing import List, Type
from uuid import uuid4

from pandas import DataFrame

from metadata.data_quality.api.models import TestCaseDefinition
from metadata.data_quality.validations.base_test_handler import BaseTestValidator
from metadata.generated.schema.tests.basic import TestCaseResult, TestCaseStatus
from metadata.generated.schema.tests.testCase import TestCase
from metadata.generated.schema.type.basic import Timestamp
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.sdk.data_quality.dataframes.validators import VALIDATOR_REGISTRY

logger = logging.getLogger(__name__)


class DataFrameValidatorAdapter:
    """Adapter to translate DataFrame validation to existing validator interface."""

    def __init__(
        self,
        df: DataFrame,
        test_definition: TestCaseDefinition,
    ):
        self.df: DataFrame = df
        self.test_definition: TestCaseDefinition = test_definition

    def run_validation(self) -> TestCaseResult:
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
            execution_date=Timestamp(root=int(datetime.now().timestamp() * 1000)),
        )

        try:
            return validator.run_validation()
        except Exception as err:
            message = (
                f"Error executing {test_case.testDefinition.fullyQualifiedName} - {err}"
            )
            logger.exception(message)
            return validator.get_test_case_result_object(
                validator.execution_date,
                TestCaseStatus.Aborted,
                message,
                [],
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
