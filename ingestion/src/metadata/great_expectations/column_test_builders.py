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
from metadata.generated.schema.tests.column import (
    columnValuesLengthsToBeBetween,
    columnValuesMissingCountToBeEqual,
    columnValuesToBeBetween,
    columnValuesToBeNotInSet,
    columnValuesToBeNotNull,
    columnValuesToBeUnique,
    columnValuesToMatchRegex,

)
from metadata.generated.schema.tests.basic import (
    TestCaseStatus,
    TestCaseResult,
)
from metadata.generated.schema.tests.columnTest import (
    ColumnTestCase,
    ColumnTestType,
)
from metadata.generated.schema.api.tests.createColumnTest import (
    CreateColumnTestRequest
)



class ColumnValuesLengthsToBeBetweenBuilder:
    """Builder for `expect_column_value_lengths_to_be_between` GE expectation"""
    def build_test(self, result: Dict):
        timestamp = Timestamp(__root__=int(int(datetime.now().timestamp())))
        test_case = ColumnTestCase(
                        config=columnValuesLengthsToBeBetween.ColumnValueLengthsToBeBetween(
                                    minLength=result["expectation_config"]["kwargs"].get("value"),
                                    maxLength=result["expectation_config"]["kwargs"].get("value"),
                                ),
                        columnTestType=ColumnTestType.columnValueLengthsToBeBetween
                    )
        test_case_result = TestCaseResult(
                                executionTime=timestamp,
                                testCaseStatus=TestCaseStatus.Success if result["success"] else TestCaseStatus.Failed,
                                result=f"Unexpected percentage: {result['result']['unexpected_percent']}",
                            )

        return CreateColumnTestRequest(
                    columnName=result["expectation_config"]["kwargs"]["column"],
                    testCase=test_case,
                    result=test_case_result,
                    updatedAt=timestamp,
                )