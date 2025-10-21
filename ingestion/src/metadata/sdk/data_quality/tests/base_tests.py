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

"""Test definition wrappers for simplified DQ as Code API."""

from typing import List, Optional

from typing_extensions import Self

from metadata.data_quality.api.models import TestCaseDefinition
from metadata.generated.schema.tests.testCase import TestCaseParameterValue


class BaseTest:
    """Base class for all data quality test definitions.

    This class provides a fluent API for configuring test cases with metadata
    and parameters. All test definitions inherit from this base class.

    Attributes:
        test_definition_name: Internal name of the test definition type
        parameters: List of test case parameter values
        name: Unique identifier for this test case instance
        display_name: Human-readable name shown in UI
        description: Detailed description of what the test validates
        compute_passed_failed_row_count: Whether to compute row-level pass/fail counts
    """

    def __init__(
        self,
        test_definition_name: str,
        name: Optional[str] = None,
        display_name: Optional[str] = None,
        description: Optional[str] = None,
        compute_passed_failed_row_count: bool = False,
    ):
        """Initialize a test definition.

        Args:
            test_definition_name: Internal name matching the test definition in OpenMetadata
            name: Unique identifier for this test case (auto-generated if not provided)
            display_name: Human-readable name for UI display (auto-generated if not provided)
            description: Description of what this test validates (auto-generated if not provided)
        """
        self.test_definition_name: str = test_definition_name
        self.parameters: List[TestCaseParameterValue] = []
        self.name: Optional[str] = name
        self.display_name: Optional[str] = display_name
        self.description: Optional[str] = description
        self.compute_passed_failed_row_count: bool = compute_passed_failed_row_count

    def with_name(self, name: str) -> Self:
        """Set a custom test case name.

        Args:
            name: Unique identifier for this test case

        Returns:
            Self for method chaining
        """
        self.name = name
        return self

    def with_display_name(self, display_name: str) -> Self:
        """Set a custom display name.

        Args:
            display_name: Human-readable name for UI display

        Returns:
            Self for method chaining
        """
        self.display_name = display_name
        return self

    def with_description(self, description: str) -> Self:
        """Set a custom description.

        Args:
            description: Detailed description of what this test validates

        Returns:
            Self for method chaining
        """
        self.description = description
        return self

    def with_compute_row_count(self, compute: bool = True) -> Self:
        """Enable or disable passed/failed row count computation.

        When enabled, the test will compute and report the number and percentage
        of rows that passed or failed the test validation.

        Args:
            compute: Whether to compute row-level pass/fail statistics

        Returns:
            Self for method chaining
        """
        self.compute_passed_failed_row_count = compute
        return self

    def to_test_case_definition(self) -> TestCaseDefinition:
        """Create a test case definition from this test definition.
        Returns:
            TestCaseDefinition instance
        """
        return TestCaseDefinition(
            testDefinitionName=self.test_definition_name,
            name=self.name or self.test_definition_name,
            description=self.description,
            displayName=self.display_name,
            parameterValues=self.parameters,
            computePassedFailedRowCount=self.compute_passed_failed_row_count,
        )


class TableTest(BaseTest):
    """Base class for table-level data quality test definitions.

    Table tests validate properties of entire tables, such as row counts,
    column counts, or custom SQL queries against the table.

    All table-level test definitions should inherit from this class.
    """


class ColumnTest(BaseTest):
    """Base class for column-level data quality test definitions.

    Column tests validate properties of specific columns, such as uniqueness,
    null values, value ranges, or pattern matching.

    All column-level test definitions should inherit from this class.

    Attributes:
        column_name: Name of the column this test validates
    """

    def __init__(
        self,
        test_definition_name: str,
        column: str,
        name: Optional[str] = None,
        display_name: Optional[str] = None,
        description: Optional[str] = None,
        compute_passed_failed_row_count: bool = False,
    ):
        """Initialize a column test definition.

        Args:
            test_definition_name: Internal name matching the test definition in OpenMetadata
            column: Name of the column to test
            name: Unique identifier for this test case (auto-generated if not provided)
            display_name: Human-readable name for UI display (auto-generated if not provided)
            description: Description of what this test validates (auto-generated if not provided)
        """
        super().__init__(
            test_definition_name,
            name,
            display_name,
            description,
            compute_passed_failed_row_count,
        )
        self.column_name: str = column

    def to_test_case_definition(self) -> TestCaseDefinition:
        """Create a test case definition from this test definition.
        Returns:
            TestCaseDefinition instance
        """
        return TestCaseDefinition(
            testDefinitionName=self.test_definition_name,
            name=self.name or self.test_definition_name,
            columnName=self.column_name,
            description=self.description,
            displayName=self.display_name,
            parameterValues=self.parameters,
            computePassedFailedRowCount=self.compute_passed_failed_row_count,
        )
