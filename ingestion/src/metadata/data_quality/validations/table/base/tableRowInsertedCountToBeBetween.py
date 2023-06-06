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
Validator for table row inserted count to be between test case
"""

import traceback
from abc import abstractmethod
from typing import cast

from metadata.data_quality.validations.base_test_handler import BaseTestValidator
from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()

ROW_COUNT = "rowCount"


class BaseTableRowInsertedCountToBeBetweenValidator(BaseTestValidator):
    """Validator table row inserted count to be between test case"""

    def run_validation(self) -> TestCaseResult:
        """Run validation for the given test case

        Returns:
            TestCaseResult:
        """
        column_name = self._get_column_name()
        range_type = self.get_test_case_param_value(
            self.test_case.parameterValues,  # type: ignore
            "rangeType",
            str,
        )
        range_interval = self.get_test_case_param_value(
            self.test_case.parameterValues,  # type: ignore
            "rangeInterval",
            int,
        )

        try:
            if any(var is None for var in [column_name, range_type, range_interval]):
                raise ValueError(
                    "No value found for columnName, rangeType or rangeInterval"
                )

            range_interval = cast(int, range_interval)
            column_name = cast(str, column_name)
            range_type = cast(str, range_type)

            res = self._run_results(column_name, range_type, range_interval)

        except Exception as exc:
            msg = f"Error computing {self.test_case.name}: {exc}"  # type: ignore
            logger.debug(traceback.format_exc())
            logger.warning(msg)
            return self.get_test_case_result_object(
                self.execution_date,
                TestCaseStatus.Aborted,
                msg,
                [TestResultValue(name=ROW_COUNT, value=None)],
            )

        min_bound = self.get_test_case_param_value(
            self.test_case.parameterValues,  # type: ignore
            "min",
            int,
            float("-inf"),
        )
        max_bound = self.get_test_case_param_value(
            self.test_case.parameterValues,  # type: ignore
            "max",
            int,
            float("inf"),
        )

        return self.get_test_case_result_object(
            self.execution_date,
            self.get_test_case_status(min_bound <= res <= max_bound),
            f"Found insertedRows={res} vs. the expected min={min_bound}, max={max_bound}.",
            [TestResultValue(name=ROW_COUNT, value=str(res))],
        )

    @abstractmethod
    def _get_column_name(self):
        raise NotImplementedError

    @abstractmethod
    def _run_results(self, column_name: str, range_type: str, range_interval: int):
        raise NotImplementedError
