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
Validator for column values sum to be between test case
"""

import traceback
from datetime import datetime

from metadata.generated.schema.tests.basic import (TestCaseResult,
                                                   TestCaseStatus,
                                                   TestResultValue)
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.test_suite.validations.base_test_handler import \
    BaseTestHandler
from metadata.test_suite.validations.column.column_values_to_be_between import \
    convert_timestamp
from metadata.test_suite.validations.column.mixins.sqa_validator_mixin import \
    SQAValidatorMixin
from metadata.utils.logger import test_suite_logger
from sqlalchemy import Column, inspect
from sqlalchemy.sql.sqltypes import DATE, DATETIME, TIMESTAMP

logger = test_suite_logger()

class ColumnValuesToBeNotNullValidator(BaseTestHandler, SQAValidatorMixin):
    """"Validator for column values sum to be between test case"""

    def run_validation(self) -> TestCaseResult:
        """Run validation for the given test case

        Returns:
            TestCaseResult:
        """
        try:
            column: Column = self.get_column_name(
                self.test_case.entityLink.__root__,
                inspect(self.runner.table).c,
            )
            res = self.run_query_results(self.runner, Metrics.NULL_COUNT, column)
        except ValueError as exc:
            msg = (
                f"Error computing {self.test_case.name} for {self.runner.table.__tablename__}: {exc}"  # type: ignore
            )
            logger.debug(traceback.format_exc())
            logger.warning(msg)
            return self.get_test_case_result_object(
                self.execution_date,
                TestCaseStatus.Aborted,
                msg,
                [TestResultValue(name="nullCount", value=None)],
            )

        return self.get_test_case_result_object(
            self.execution_date,
            TestCaseStatus.Success if res == 0 else TestCaseStatus.Failed,
            f"Found nullCount={res}. It should be 0.",
            [TestResultValue(name="nullCount", value=str(res))],
        )
