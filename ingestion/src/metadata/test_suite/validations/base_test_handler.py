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
Base validator class
"""

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Union

from metadata.generated.schema.tests.basic import TestCaseResult
from metadata.generated.schema.tests.testCase import TestCase
from metadata.orm_profiler.profiler.runner import QueryRunner


class BaseTestHandler(ABC):
    def __init__(
        self,
        runner: QueryRunner,
        test_case: TestCase,
        execution_date: Union[datetime, float],
    ) -> None:
        self.runner = runner
        self.test_case = test_case
        self.execution_date = execution_date

    @abstractmethod
    def run_validation(self) -> TestCaseResult:
        """Run validation for the given test case

        Returns:
            TestCaseResult:
        """
        raise NotImplementedError
