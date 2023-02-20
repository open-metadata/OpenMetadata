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
from ast import literal_eval

from metadata.generated.schema.tests.basic import (TestCaseResult,
                                                   TestCaseStatus,
                                                   TestResultValue)
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.test_suite.validations.base_test_handler import BaseTestHandler
from metadata.test_suite.validations.mixins.pandas_validator_mixin import PandasValidatorMixin
from metadata.utils.sqa_like_column import SQALikeColumn
from metadata.test_suite.validations.mixins.sqa_validator_mixin import \
    SQAValidatorMixin
from metadata.utils.entity_link import get_table_fqn
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class ColumnValuesMissingCountValidator(BaseTestHandler, PandasValidatorMixin):
    """ "Validator for column value missing count to be equal test case"""

    def run_validation(self) -> TestCaseResult:
        """Run validation for the given test case

        Returns:
            TestCaseResult:
        """
        try:
            column: SQALikeColumn = self.get_column_name(
                self.test_case.entityLink.__root__,
                self.runner,
            )
            null_res = self.run_dataframe_results(self.runner, Metrics.NULL_COUNT, column)
        except (ValueError, RuntimeError) as exc:
            msg = f"Error computing {self.test_case.name} for {get_table_fqn(self.test_case.entityLink.__root__)}: {exc}"
            logger.debug(traceback.format_exc())
            logger.warning(msg)
            return self.get_test_case_result_object(
                self.execution_date,
                TestCaseStatus.Aborted,
                msg,
                [TestResultValue(name="nullCount", value=None)],
            )

        missing_values = self.get_test_case_param_value(
            self.test_case.parameterValues,  # type: ignore
            "missingValueMatch",
            literal_eval,
        )

        missing_count_value = self.get_test_case_param_value(
            self.test_case.parameterValues,  # type: ignore
            "missingCountValue",
            literal_eval,
        )

        if missing_values:
            # if user supplies missing values, we need to compute the count of missing values
            # in addition to the count of null values
            try:
                set_res = self.run_dataframe_results(
                    self.runner, Metrics.COUNT_IN_SET, column, values=missing_values
                )

                null_res += set_res
            except (ValueError, RuntimeError) as exc:
                msg = f"Error computing {self.test_case.name} for {get_table_fqn(self.test_case.entityLink.__root__)}: {exc}"
                logger.debug(traceback.format_exc())
                logger.warning(msg)
                return self.get_test_case_result_object(
                    self.execution_date,
                    TestCaseStatus.Aborted,
                    msg,
                    [
                        TestResultValue(name="nullCount", value=None),
                    ],
                )

        return self.get_test_case_result_object(
            self.execution_date,
            self.get_test_case_status(missing_count_value == null_res),
            f"Found nullCount={null_res} vs. the expected nullCount={missing_count_value}.",
            [TestResultValue(name="nullCount", value=str(null_res))],
        )
