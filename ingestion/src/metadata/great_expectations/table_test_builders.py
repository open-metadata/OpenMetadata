#  Copyright 2022 Collate
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
TestCase builder handlers
"""

from typing import Dict
from datetime import datetime

from metadata.generated.schema.type.basic import Timestamp
from metadata.generated.schema.tests.table.tableColumnCountToEqual import (
    TableColumnCountToEqual,
)
from metadata.generated.schema.tests.basic import (
    TestCaseStatus,
    TestCaseResult,
)
from metadata.generated.schema.tests.tableTest import (
    TableTestCase,
    TableTestType,
    TableTest,
)
from metadata.generated.schema.api.tests.createTableTest import (
    CreateTableTestRequest
)

class GenericTableTestCaseBuilder:
    """Generic TestCase builder to create test case entity
    
    Attributes:
        test_case_builder (obj): Specific builder for the GE expectation
    """
    def __init__(self, *, test_case_builder):
        self.test_case_builder = test_case_builder

    def build_table_test(self, result: Dict):
        """Main method to build the test case entity"""
        return CreateTableTestRequest(
            testCase=self.test_case_builder.build_test_case(result),
            result=self.test_case_builder.build_test_result(result),
            updatedAt=Timestamp(__root__=int(int(datetime.now().timestamp()))),
        )
        


class TableColumCountToEqualBuilder:
    """Builder for `expect_table_column_count_to_equal` GE expectation"""
    def build_test_case(self, result: Dict):
        """Build TestCase entity"""
        return TableTestCase(
                    config=TableColumnCountToEqual(
                                columnCount=result["expectation_config"]["kwargs"]["value"]
                            ),
                    tableTestType=TableTestType.tableRowCountToEqual
                )


    def build_test_result(self, result: Dict):
        """Build TestResult entity"""
        return TestCaseResult(
            executionTime=Timestamp(__root__=int(int(datetime.now().timestamp()))),
            testCaseStatus=TestCaseStatus.Success if result["success"] else TestCaseStatus.Failed,
            result=result["result"]["observed_value"],
        )