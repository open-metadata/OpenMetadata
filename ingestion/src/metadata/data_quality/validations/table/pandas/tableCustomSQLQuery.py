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
Validator for table custom SQL Query test case
"""

from typing import List, Optional

from metadata.data_quality.validations.mixins.pandas_validator_mixin import (
    PandasValidatorMixin,
)
from metadata.data_quality.validations.table.base.tableCustomSQLQuery import (
    BaseTableCustomSQLQueryValidator,
    Strategy,
)
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()


class TableCustomSQLQueryValidator(
    BaseTableCustomSQLQueryValidator, PandasValidatorMixin
):
    """Validator for table custom SQL Query test case"""

    def _run_results(self, sql_expression: str, strategy: Strategy = Strategy.ROWS):
        """compute result of the test case"""
        return sum(  # pylint: disable=consider-using-generator
            [
                len(runner.query(sql_expression))
                for runner in self.runner
                if len(runner.query(sql_expression))
            ]
        )

    def compute_row_count(self) -> Optional[int]:
        """Compute row count for the given column

        Returns:
            Optional[int]: Total number of rows across all dataframes
        """
        runner: List["DataFrame"] = self.runner  # type: ignore

        if not runner:
            return None

        total_rows = 0
        partition_expression = next(
            (
                param.value
                for param in self.test_case.parameterValues
                if param.name == "partitionExpression"
            ),
            None,
        )
        for dataframe in runner:
            if dataframe is not None:
                if partition_expression:
                    try:
                        total_rows += len(dataframe.query(partition_expression))
                    except Exception as e:
                        logger.error(
                            "Error executing partition expression, "
                            f"expression may be invalid: {partition_expression} - {e}"
                        )
                        return None
                else:
                    total_rows += len(dataframe.index)

        return total_rows if total_rows > 0 else None
