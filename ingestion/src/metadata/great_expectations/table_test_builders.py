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
from metadata.generated.schema.tests.table import (
    tableRowCountToBeBetween,
    tableRowCountToEqual,
    tableColumnCountToEqual

)
from metadata.generated.schema.tests.basic import (
    TestCaseStatus,
    TestCaseResult,
)
from metadata.generated.schema.tests.tableTest import (
    TableTestCase,
    TableTestType,
)
from metadata.generated.schema.api.tests.createTableTest import (
    CreateTableTestRequest
)        


class TableColumCountToEqualBuilder:
    """Builder for `expect_table_column_count_to_equal` GE expectation"""
    def build_test(self, result: Dict):
        timestamp = Timestamp(__root__=int(int(datetime.now().timestamp())))
        test_case = TableTestCase(
                        config=tableColumnCountToEqual.TableColumnCountToEqual(
                                    columnCount=result["expectation_config"]["kwargs"]["value"]
                                ),
                        tableTestType=TableTestType.tableColumnCountToEqual
                    )
        test_case_result = TestCaseResult(
                                executionTime=timestamp,
                                testCaseStatus=TestCaseStatus.Success if result["success"] else TestCaseStatus.Failed,
                                result=result["result"]["observed_value"],
                            )

        return CreateTableTestRequest(
                    testCase=test_case,
                    result=test_case_result,
                    updatedAt=timestamp,
                )


class TableRowCountToBeBetweenBuilder:
    """Builder for `expect_table_row_count_to_be_between` GE expectation"""
    def build_test(self, result: Dict):
        timestamp = Timestamp(__root__=int(int(datetime.now().timestamp())))
        test_case = TableTestCase(
                        config=tableRowCountToBeBetween.TableRowCountToBeBetween(
                                    minValue=result["expectation_config"]["kwargs"]["min_value"],
                                    maxValue=result["expectation_config"]["kwargs"]["max_value"],
                                ),
                        tableTestType=TableTestType.tableRowCountToBeBetween
                    )
        test_case_result = TestCaseResult(
                                executionTime=timestamp,
                                testCaseStatus=TestCaseStatus.Success if result["success"] else TestCaseStatus.Failed,
                                result=result["result"]["observed_value"],
                            )

        return CreateTableTestRequest(
                    testCase=test_case,
                    result=test_case_result,
                    updatedAt=timestamp,
                )


class TableRowCountToEqualBuilder:
    """Builder for `expect_table_row_count_to_equal` GE expectation"""
    def build_test(self, result: Dict):
        timestamp = Timestamp(__root__=int(int(datetime.now().timestamp())))
        test_case = TableTestCase(
                        config=tableRowCountToEqual.TableRowCountToEqual(
                                    value=result["expectation_config"]["kwargs"]["value"],
                                ),
                        tableTestType=TableTestType.tableRowCountToEqual
                    )
        test_case_result = TestCaseResult(
                                executionTime=timestamp,
                                testCaseStatus=TestCaseStatus.Success if result["success"] else TestCaseStatus.Failed,
                                result=result["result"]["observed_value"],
                            )

        return CreateTableTestRequest(
                    testCase=test_case,
                    result=test_case_result,
                    updatedAt=timestamp,
                )