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

from sqlalchemy import Column, inspect, text

from metadata.data_quality.validations.mixins.sqa_validator_mixin import (
    SQAValidatorMixin,
)
from metadata.data_quality.validations.table.base.tableRowInsertedCountToBeBetween import (
    BaseTableRowInsertedCountToBeBetweenValidator,
)
from metadata.profiler.metrics.registry import Metrics
from metadata.utils.sqa_utils import (
    dispatch_to_date_or_datetime,
    get_partition_col_type,
)


class TableRowInsertedCountToBeBetweenValidator(
    BaseTableRowInsertedCountToBeBetweenValidator, SQAValidatorMixin
):
    """Validator for table row inserted count to be between test case"""

    def _get_column_name(self):
        """returns the column name to be validated"""
        return self.get_test_case_param_value(
            self.test_case.parameterValues,  # type: ignore
            "columnName",
            Column,
        )

    def _run_results(self, column_name: str, range_type: str, range_interval: int):
        """Execute the validation for the given test case

        Args:
            column_name (str): column name
            range_type (str): range type (DAY, HOUR, MONTH, YEAR)
            range_interval (int): range interval
        """
        date_or_datetime_fn = dispatch_to_date_or_datetime(
            range_interval,
            text(range_type),
            get_partition_col_type(column_name.name, inspect(self.runner.dataset).c),  # type: ignore
        )

        return dict(
            self.runner.dispatch_query_select_first(
                Metrics.ROW_COUNT.value().fn(),
                query_filter_={
                    "filters": [(column_name, "ge", date_or_datetime_fn)],
                    "or_filter": False,
                },
            )  # type: ignore
        ).get(Metrics.ROW_COUNT.name)
