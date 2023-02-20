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
# pylint: disable=invalid-name

"""
Validator for column value length to be between test case
"""

import traceback
from typing import cast
from datetime import datetime

from dateutil.relativedelta import relativedelta

from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.test_suite.validations.base_test_handler import BaseTestHandler
from metadata.utils.logger import test_suite_logger
from metadata.test_suite.validations.mixins.pandas_validator_mixin import PandasValidatorMixin

logger = test_suite_logger()


class TableRowInsertedCountToBeBetweenValidator(BaseTestHandler, PandasValidatorMixin):
    """ "Validator for column value mean to be between test case"""

    def get_threshold_date(self, range_type: str, range_interval: int):
        """returns the threshold datetime in utc to count the numbers of rows inserted

        Args:
            range_type (str): type of range (i.e. HOUR, DAY, MONTH, YEAR)
            range_interval (int): interval of range (i.e. 1, 2, 3, 4)
        """
        interval_type_matching_table = {
            "HOUR": relativedelta(hours=range_interval),
            "DAY": relativedelta(days=range_interval),
            "MONTH": relativedelta(months=range_interval),
            "YEAR": relativedelta(years=range_interval),
        }  
        utc_now = datetime.utcnow()
        threshold_date = utc_now - interval_type_matching_table[range_type]
        if range_type == "HOUR":
            threshold_date = threshold_date.replace(minute=0, second=0, microsecond=0)
        else:
            threshold_date = threshold_date.replace(hour=0, minute=0, second=0, microsecond=0)
        return threshold_date.strftime("%Y%m%d%H%M%S")


    def run_validation(self) -> TestCaseResult:
        """Run validation for the given test case

        Returns:
            TestCaseResult:
        """
        column_name = self.get_test_case_param_value(
            self.test_case.parameterValues,  # type: ignore
            "columnName",
            str,
        )
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
            range_type = cast(str, range_type)

            threshold_date = self.get_threshold_date(range_type, range_interval)

            res = len(self.runner.query(f"{column_name} >= {threshold_date}"))

        except Exception as exc:
            msg = f"Error computing {self.test_case.name} for {self.runner.table.__tablename__}: {exc}"  # type: ignore
            logger.debug(traceback.format_exc())
            logger.warning(msg)
            return self.get_test_case_result_object(
                self.execution_date,
                TestCaseStatus.Aborted,
                msg,
                [TestResultValue(name="rowCount", value=None)],
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
            [TestResultValue(name="rowCount", value=str(res))],
        )
