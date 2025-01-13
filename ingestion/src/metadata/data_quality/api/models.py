#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
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

from typing import List, Optional

from pydantic import Field

from metadata.config.common import ConfigModel
from metadata.generated.schema.api.tests.createTestSuite import CreateTestSuiteRequest
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.generated.schema.tests.basic import TestCaseResult
from metadata.generated.schema.tests.testCase import TestCase, TestCaseParameterValue
from metadata.ingestion.models.custom_pydantic import BaseModel


class TestCaseDefinition(ConfigModel):
    """Test case definition for the CLI"""

    name: str
    displayName: Optional[str] = None
    description: Optional[str] = None
    testDefinitionName: str
    columnName: Optional[str] = None
    parameterValues: Optional[List[TestCaseParameterValue]] = None
    computePassedFailedRowCount: Optional[bool] = False


class TestSuiteProcessorConfig(ConfigModel):
    """class for the processor config"""

    testCases: Optional[List[TestCaseDefinition]] = None
    forceUpdate: Optional[bool] = False


class TestCaseResultResponse(BaseModel):
    testCaseResult: TestCaseResult
    testCase: TestCase


class TableAndTests(BaseModel):
    """Source response bringing together the table and test cases"""

    table: Table = Field(None, description="Table being processed by the DQ workflow")
    service_type: str = Field(..., description="Service type the table belongs to")
    test_cases: List[TestCase] = Field(
        None, description="Test Cases already existing in the Test Suite, if any"
    )
    executable_test_suite: Optional[CreateTestSuiteRequest] = Field(
        None, description="If no executable test suite is found, we'll create one"
    )
    service_connection: DatabaseConnection = Field(
        ..., description="Service connection for the given table"
    )


class TestCaseResults(BaseModel):
    """Processor response with a list of computed Test Case Results"""

    test_results: Optional[List[TestCaseResultResponse]]
