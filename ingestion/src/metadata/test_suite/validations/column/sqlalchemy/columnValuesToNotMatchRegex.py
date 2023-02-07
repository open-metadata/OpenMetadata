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
Validator for column values to not match regex test case
"""

import traceback

from metadata.generated.schema.tests.basic import (TestCaseResult,
                                                   TestCaseStatus,
                                                   TestResultValue)
from metadata.orm_profiler.metrics.registry import Metrics
from metadata.test_suite.validations.base_test_handler import \
    BaseTestHandler
from metadata.test_suite.validations.column.mixins.sqa_validator_mixin import \
    SQAValidatorMixin
from metadata.utils.logger import test_suite_logger
from sqlalchemy import Column, inspect
from sqlalchemy.exc import CompileError

logger = test_suite_logger()

class ColumnValuesToNotMatchRegexValidator(BaseTestHandler, SQAValidatorMixin):
    """"Validator for column values to not match regex test case"""

    def get_not_match_count(self, column: Column, regex: str):
        """Not all database engine support REGEXP (e.g. MSSQL) so we'll fallback to LIKE.

        `regexp_match` will fall back to REGEXP. If a database implements a different regex syntax
        and has not implemented the sqlalchemy logic we should also fall back.

        Args:
            column: SQA column
            regex: regex pattern

        Returns:
            int
        """
        try:
            return self.run_query_results(self.runner, Metrics.NOT_REGEX_COUNT, column, expression=regex)
        except CompileError as err:
            logger.warning(f"Could not use `REGEXP` due to - {err}. Falling back to `LIKE`")
            return self.run_query_results(self.runner, Metrics.NOT_LIKE_COUNT, column, expression=regex)

    def run_validation(self) -> TestCaseResult:
        """Run validation for the given test case

        Returns:
            TestCaseResult:
        """
        forbidden_regex: str = self.get_test_case_param_value(
            self.test_case.parameterValues,  # type: ignore
            "forbiddenRegex",
            str,
        )
        try:
            column: Column = self.get_column_name(
                self.test_case.entityLink.__root__,
                inspect(self.runner.table).c,
            )
            not_match_count = self.get_not_match_count(column, forbidden_regex)
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
                [TestResultValue(name="notLikeCount", value=None)],
            )

        return self.get_test_case_result_object(
            self.execution_date,
            TestCaseStatus.Success if not not_match_count else TestCaseStatus.Failed,
            f"Found {not_match_count} value(s) matching the forbidden regex pattern vs {not_match_count} value(s) in the column.",
            [TestResultValue(name="notLikeCount", value=str(not_match_count))]
        )
