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
Custom pydantic models for tests suites and requests
"""

from typing import List

from pydantic import BaseModel

from metadata.generated.schema.api.tests.createTestCase import CreateTestCaseRequest
from metadata.generated.schema.api.tests.createTestCaseResolutionStatus import (
    CreateTestCaseResolutionStatus,
)
from metadata.generated.schema.api.tests.createTestSuite import CreateTestSuiteRequest
from metadata.generated.schema.tests.basic import TestCaseResult
from metadata.generated.schema.tests.testCase import TestCase


class OMetaTestSuiteSample(BaseModel):
    test_suite: CreateTestSuiteRequest


class OMetaLogicalTestSuiteSample(BaseModel):
    test_suite: CreateTestSuiteRequest
    test_cases: List[TestCase]


class OMetaTestCaseSample(BaseModel):
    test_case: CreateTestCaseRequest


class OMetaTestCaseResultsSample(BaseModel):
    test_case_results: TestCaseResult
    test_case_name: str


class OMetaTestCaseResolutionStatus(BaseModel):
    """For sample data"""

    test_case_resolution: CreateTestCaseResolutionStatus
