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
Validator for table row inserted count to be between test case
"""

from datetime import datetime, timezone

from dateutil.relativedelta import relativedelta

from metadata.data_quality.validations.mixins.pandas_validator_mixin import (
    PandasValidatorMixin,
)
from metadata.data_quality.validations.table.base.tableRowInsertedCountToBeBetween import (
    BaseTableRowInsertedCountToBeBetweenValidator,
)
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class TableRowInsertedCountToBeBetweenValidator(
    BaseTableRowInsertedCountToBeBetweenValidator, PandasValidatorMixin
):
    """Validator for table row inserted count to be between test case"""

    @staticmethod
    def _get_threshold_date(range_type: str, range_interval: int):
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
        utc_now = datetime.now(timezone.utc)
        threshold_date = utc_now - interval_type_matching_table[range_type]
        if range_type == "HOUR":
            threshold_date = threshold_date.replace(minute=0, second=0, microsecond=0)
        else:
            threshold_date = threshold_date.replace(
                hour=0, minute=0, second=0, microsecond=0
            )
        return threshold_date.strftime("%Y%m%d%H%M%S")

    def _get_column_name(self):
        """returns the column name to be validated"""
        return self.get_test_case_param_value(
            self.test_case.parameterValues,  # type: ignore
            "columnName",
            str,
        )

    def _run_results(self, column_name: str, range_type: str, range_interval: int):
        """Execute the validation for the given test case

        Args:
            column_name (str): column name
            range_type (str): range type (DAY, HOUR, MONTH, YEAR)
            range_interval (int): range interval
        """
        threshold_date = self._get_threshold_date(range_type, range_interval)
        return sum(
            len(runner.query(f"{column_name} >= {threshold_date}"))
            for runner in self.runner
        )
