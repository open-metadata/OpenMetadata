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

from metadata.config.common import ConfigModel
from metadata.generated.schema.tests.testCase import TestCaseParameterValue


class TestCaseDefinition(ConfigModel):
    """Test case definition for the CLI"""

    name: str
    displayName: Optional[str] = None
    description: Optional[str] = None
    testDefinitionName: str
    columnName: Optional[str] = None
    parameterValues: Optional[List[TestCaseParameterValue]]


class TestSuiteProcessorConfig(ConfigModel):
    """class for the processor config"""

    testCases: Optional[List[TestCaseDefinition]] = None
    forceUpdate: Optional[bool] = False
