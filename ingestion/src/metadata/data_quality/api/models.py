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

"""
Return types for TestSuite workflow execution.

We need to define this class as we end up having
multiple test cases per workflow.
"""

from typing import List, Optional  # noqa: UP035

from pydantic import Field

from metadata.config.common import ConfigModel
from metadata.generated.schema.api.tests.createTestSuite import CreateTestSuiteRequest
from metadata.generated.schema.entity.data.table import Table, TableData
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.generated.schema.tests.basic import TestCaseResult
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.ingestion.models.custom_pydantic import BaseModel


class TestCaseDefinition(ConfigModel):
    """Test case definition for the CLI"""

    name: str
    displayName: Optional[str] = None  # noqa: N815, UP045
    description: Optional[str] = None  # noqa: UP045
    testDefinitionName: str  # noqa: N815
    columnName: Optional[str] = None  # noqa: N815, UP045
    parameterValues: Optional[List[TestCaseParameterValue]] = None  # noqa: N815, UP006, UP045
    computePassedFailedRowCount: Optional[bool] = False  # noqa: N815, UP045


class TestSuiteProcessorConfig(ConfigModel):
    """class for the processor config"""

    testCases: Optional[List[TestCaseDefinition]] = None  # noqa: N815, UP006, UP045
    forceUpdate: Optional[bool] = False  # noqa: N815, UP045


class TestCaseResultResponse(BaseModel):
    testCaseResult: TestCaseResult  # noqa: N815
    testCase: TestCase  # noqa: N815
    failedRowsSample: Optional[TableData] = None  # noqa: N815, UP045
    inspectionQuery: Optional[str] = None  # noqa: N815, UP045
    validateColumns: bool = True  # noqa: N815


class TableAndTests(BaseModel):
    """Source response bringing together the table and test cases"""

    table: Table = Field(None, description="Table being processed by the DQ workflow")
    service_type: str = Field(..., description="Service type the table belongs to")
    test_cases: List[TestCase] = Field(None, description="Test Cases already existing in the Test Suite, if any")  # noqa: UP006
    executable_test_suite: Optional[CreateTestSuiteRequest] = Field(  # noqa: UP045
        None, description="If no executable test suite is found, we'll create one"
    )
    service_connection: DatabaseConnection = Field(..., description="Service connection for the given table")


class TestCaseResults(BaseModel):
    """Processor response with a list of computed Test Case Results"""

    test_results: Optional[List[TestCaseResultResponse]]  # noqa: UP006, UP045
