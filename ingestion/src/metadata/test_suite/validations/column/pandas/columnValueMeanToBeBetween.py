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
Validator for column value mean to be between test case
"""

import traceback

from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.test_suite.validations.base_test_handler import BaseTestHandler
from metadata.test_suite.validations.mixins.pandas_validator_mixin import (
    PandasValidatorMixin,
)
from metadata.utils.entity_link import get_table_fqn
from metadata.utils.logger import test_suite_logger
from metadata.utils.sqa_like_column import SQALikeColumn

logger = test_suite_logger()


class ColumnValueMeanToBeBetweenValidator(BaseTestHandler, PandasValidatorMixin):
    """ "Validator for column value mean to be between test case"""

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
            res = self.run_dataframe_results(self.runner, Metrics.MEAN, column)
        except (ValueError, RuntimeError) as exc:
            msg = (
                f"Error computing {self.test_case.name} for "
                f"{get_table_fqn(self.test_case.entityLink.__root__)}: {exc}"
            )
            logger.debug(traceback.format_exc())
            logger.warning(msg)
            return self.get_test_case_result_object(
                self.execution_date,
                TestCaseStatus.Aborted,
                msg,
                [TestResultValue(name="mean", value=None)],
            )

        min_bound = self.get_min_bound("minValueForMeanInCol")
        max_bound = self.get_max_bound("maxValueForMeanInCol")

        return self.get_test_case_result_object(
            self.execution_date,
            self.get_test_case_status(min_bound <= res <= max_bound),
            f"Found mean={res} vs.  the expected min={min_bound}, max={max_bound}.",
            [TestResultValue(name="mean", value=str(res))],
        )
