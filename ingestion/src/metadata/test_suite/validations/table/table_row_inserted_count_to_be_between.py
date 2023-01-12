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
TableRowInsertedCountToBeBetween validation implementation
"""

from datetime import datetime

from metadata.orm_profiler.profiler.runner import QueryRunner
from metadata.test_suite.api.models import TestCaseDefinition
from metadata.test_suite.runner.models import TestCaseResultResponse


def table_row_inserted_count_to_be_between(
        test_case: TestCaseDefinition,
        execution_date: datetime,
        runner: QueryRunner,
    ) -> TestCaseResultResponse:
        ...