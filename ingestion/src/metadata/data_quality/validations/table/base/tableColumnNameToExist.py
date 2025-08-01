#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Validator for table column nanme to exist test case
"""

import traceback
from abc import abstractmethod

from metadata.data_quality.validations.base_test_handler import BaseTestValidator
from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()

COLUMN_NAMES_EXISTS = "columnNameExits"


class BaseTableColumnNameToExistValidator(BaseTestValidator):
    """Validator for table column nanme to exist test case"""

    def run_validation(self) -> TestCaseResult:
        """Run validation for the given test case

        Returns:
            TestCaseResult:
        """
        try:
            names = self._run_results()
        except Exception as exc:
            msg = f"Error computing {self.test_case.fullyQualifiedName}: {exc}"  # type: ignore
            logger.debug(traceback.format_exc())
            logger.warning(msg)
            return self.get_test_case_result_object(
                self.execution_date,
                TestCaseStatus.Aborted,
                msg,
                [TestResultValue(name=COLUMN_NAMES_EXISTS, value=None)],
            )

        name_to_exist = self.get_test_case_param_value(
            self.test_case.parameterValues, "columnName", str  # type: ignore
        )

        status = self.get_test_case_status(name_to_exist in names)
        result_value = 1 if status == TestCaseStatus.Success else 0

        return self.get_test_case_result_object(
            self.execution_date,
            status,
            f"{name_to_exist} column expected vs {self.format_column_list(status, names)}",
            [TestResultValue(name=COLUMN_NAMES_EXISTS, value=str(result_value))],
        )

    @abstractmethod
    def _run_results(self):
        raise NotImplementedError
