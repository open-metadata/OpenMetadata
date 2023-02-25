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
Main class to run data tests
"""


from metadata.generated.schema.tests.testCase import TestCase
from metadata.interfaces.test_suite_protocol import TestSuiteProtocol
from metadata.test_suite.runner.models import TestCaseResultResponse
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class DataTestsRunner:
    """class to execute the test validation"""

    def __init__(self, test_runner_interface: TestSuiteProtocol):
        self.test_runner_interace = test_runner_interface

    def run_and_handle(self, test_case: TestCase):
        """run and handle test case validation"""
        logger.info(
            f"Executing test case {test_case.name.__root__} "
            f"for entity {self.test_runner_interace.table_entity.fullyQualifiedName.__root__}"
        )
        test_result = self.test_runner_interace.run_test_case(
            test_case,
        )

        if test_result:
            return TestCaseResultResponse(
                testCaseResult=test_result, testCase=test_case
            )
        return None
