#  Copyright 2024 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
# pylint: disable=missing-module-docstring
import traceback
from itertools import islice
from typing import Dict, List, Optional
from urllib.parse import urlparse

import data_diff
import sqlalchemy.types
from data_diff.diff_tables import DiffResultWrapper
from data_diff.errors import DataDiffMismatchingKeyTypesError
from data_diff.utils import ArithAlphanumeric, safezip
from sqlalchemy import Column as SAColumn

from metadata.data_quality.validations.base_test_handler import BaseTestValidator
from metadata.data_quality.validations.mixins.sqa_validator_mixin import (
    SQAValidatorMixin,
)
from metadata.data_quality.validations.models import TableDiffRuntimeParameters
from metadata.data_quality.validations.runtime_param_setter.table_diff_params_setter import (
    TableDiffParamsSetter,
)
from metadata.generated.schema.entity.data.table import Column
from metadata.generated.schema.entity.services.connections.database.sapHanaConnection import (
    SapHanaScheme,
)
from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.profiler.orm.registry import Dialects
from metadata.utils.logger import test_suite_logger

logger = test_suite_logger()

SUPPORTED_DIALECTS = [
    Dialects.Snowflake,
    Dialects.BigQuery,
    Dialects.Athena,
    Dialects.Redshift,
    Dialects.Postgres,
    Dialects.MySQL,
    Dialects.MSSQL,
    Dialects.Oracle,
    Dialects.Trino,
    SapHanaScheme.hana.value,
]


class UnsupportedDialectError(Exception):
    def __init__(self, param: str, dialect: str):
        super().__init__(f"Unsupported dialect in param {param}: {dialect}")


class TableDiffValidator(BaseTestValidator, SQAValidatorMixin):
    """
    Compare two tables and fail if the number of differences exceeds a threshold
    """

    runtime_parameter_setter = TableDiffParamsSetter

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.runtime_params: TableDiffRuntimeParameters = self.get_runtime_params()

    def run_validation(self) -> TestCaseResult:
        try:
            self._validate_dialects()
            return self._run()
        except DataDiffMismatchingKeyTypesError as e:
            result = TestCaseResult(
                timestamp=self.execution_date,  # type: ignore
                testCaseStatus=TestCaseStatus.Failed,
                result=str(e),
            )
            return result
        except UnsupportedDialectError as e:
            result = TestCaseResult(
                timestamp=self.execution_date,  # type: ignore
                testCaseStatus=TestCaseStatus.Aborted,
                result=str(e),
            )
            return result
        except Exception as e:
            logger.error(
                f"Unexpected error while running the table diff test: {str(e)}\n{traceback.format_exc()}"
            )
            result = TestCaseResult(
                timestamp=self.execution_date,  # type: ignore
                testCaseStatus=TestCaseStatus.Aborted,
                result=f"ERROR: Unexpected error while running the table diff test: {str(e)}",
            )
            logger.debug(result.result)
            return result

    def _run(self) -> TestCaseResult:
        result = self.get_column_diff()
        if result:
            return result
        threshold = self.get_test_case_param_value(
            self.test_case.parameterValues, "threshold", int, default=0
        )
        table_diff_iter = self.get_table_diff()

        if not threshold or self.test_case.computePassedFailedRowCount:
            stats = table_diff_iter.get_stats_dict()
            if stats["total"] > 0:
                logger.debug("Sample of failed rows:")
                for s in islice(self.get_table_diff(), 10):
                    logger.debug(s)
            test_case_result = self.get_test_case_result(
                threshold,
                stats["total"],
                stats["updated"],
                stats["exclusive_A"],
                stats["exclusive_B"],
            )
            count = self._compute_row_count(self.runner, None)  # type: ignore
            test_case_result.passedRows = stats["unchanged"]
            test_case_result.failedRows = stats["total"]
            test_case_result.passedRowsPercentage = (
                test_case_result.passedRows / count * 100
            )
            test_case_result.failedRowsPercentage = (
                test_case_result.failedRows / count * 100
            )
            return test_case_result
        num_dffs = sum(1 for _ in islice(table_diff_iter, threshold))
        return self.get_test_case_result(
            num_dffs,
            threshold,
        )

    def get_incomparable_columns(self) -> List[str]:
        """Get the columns that have incompatible types in the two tables"""
        table1 = data_diff.connect_to_table(
            self.runtime_params.table1.serviceUrl,
            self.runtime_params.table1.path,
            self.runtime_params.keyColumns,
            extra_columns=self.runtime_params.extraColumns,
        ).with_schema()
        table2 = data_diff.connect_to_table(
            self.runtime_params.table2.serviceUrl,
            self.runtime_params.table2.path,
            self.runtime_params.keyColumns,
            extra_columns=self.runtime_params.extraColumns,
        ).with_schema()
        result = []
        columns1 = table1.key_columns + table1.extra_columns
        columns2 = table2.key_columns + table2.extra_columns
        for col1, col2 in safezip(columns1, columns2):
            col1_type = self.get_column_type(
                table1._schema[col1]  # pylint: disable=protected-access
            )
            if table2._schema.get(col2) is None:  # pylint: disable=protected-access
                continue
            col2_type = self.get_column_type(
                table2._schema[col2]  # pylint: disable=protected-access
            )

            if col1_type != col2_type:
                result.append(col1)
        return result

    @staticmethod
    def get_column_type(column: SAColumn):
        """Try to resolve the python_type of a column by cascading through different SQLAlchemy types.
        If no type is found, return the name of the column type. This is usually undesirable since it can
        be very database specific, but it is better than nothing.

        Args:
            column: An SQLAlchemy column object
        """
        result = None
        try:
            result = column.python_type
        except AttributeError:
            pass
        try:
            result = getattr(sqlalchemy.types, type(column).__name__)().python_type
        except AttributeError:
            pass
        try:
            result = getattr(
                sqlalchemy.types, type(column).__name__.upper()
            )().python_type
        except AttributeError:
            pass
        if result == ArithAlphanumeric:
            result = str
        elif result == bool:
            result = int
        elif result is None:
            return type(result)
        return result

    def get_table_diff(self) -> DiffResultWrapper:
        """Calls data_diff.diff_tables with the parameters from the test case."""
        table1 = data_diff.connect_to_table(
            self.runtime_params.table1.serviceUrl,
            self.runtime_params.table1.path,
            self.runtime_params.keyColumns,  # type: ignore
        )
        table2 = data_diff.connect_to_table(
            self.runtime_params.table2.serviceUrl,
            self.runtime_params.table2.path,
            self.runtime_params.keyColumns,  # type: ignore
        )
        data_diff_kwargs = {
            "key_columns": self.runtime_params.keyColumns,
            "extra_columns": self.runtime_params.extraColumns,
            "where": self.get_where(),
        }
        logger.debug(
            "Calling table diff with parameters:"  # pylint: disable=consider-using-f-string
            " table1={}, table2={}, kwargs={}".format(
                table1.table_path,
                table2.table_path,
                ",".join(f"{k}={v}" for k, v in data_diff_kwargs.items()),
            )
        )
        return data_diff.diff_tables(table1, table2, **data_diff_kwargs)  # type: ignore

    def get_where(self) -> Optional[str]:
        """Returns the where clause from the test case parameters or None if it is a blank string."""
        return self.runtime_params.whereClause or None

    def get_runtime_params(self) -> TableDiffRuntimeParameters:
        raw = self.get_test_case_param_value(
            self.test_case.parameterValues, "runtimeParams", str
        )
        runtime_params = TableDiffRuntimeParameters.parse_raw(raw)
        return runtime_params

    def get_test_case_result(
        self,
        threshold: int,
        total_diffs: int,
        changed: Optional[int] = None,
        removed: Optional[int] = None,
        added: Optional[int] = None,
    ) -> TestCaseResult:
        return TestCaseResult(
            timestamp=self.execution_date,  # type: ignore
            testCaseStatus=self.get_test_case_status(
                (threshold or total_diffs) == 0 or total_diffs < threshold
            ),
            result=f"Found {total_diffs} different rows which is more than the threshold of {threshold}",
            validateColumns=False,
            testResultValue=[
                TestResultValue(name="removedRows", value=str(removed)),
                TestResultValue(name="addedRows", value=str(added)),
                TestResultValue(name="changedRows", value=str(changed)),
                TestResultValue(name="diffCount", value=str(total_diffs)),
            ],
        )

    def _validate_dialects(self):
        for name, param in [
            ("table1.serviceUrl", self.runtime_params.table1.serviceUrl),
            ("table2.serviceUrl", self.runtime_params.table2.serviceUrl),
        ]:
            dialect = urlparse(param).scheme
            if dialect not in SUPPORTED_DIALECTS:
                raise UnsupportedDialectError(name, dialect)

    def get_column_diff(self) -> Optional[TestCaseResult]:
        column_diff = self.calculate_column_diff(
            self.runtime_params.table1.columns, self.runtime_params.table2.columns
        )
        changed = self.get_incomparable_columns()
        if column_diff["removed"] or column_diff["added"] or changed:
            return self.column_validation_result(
                column_diff["removed"],
                column_diff["added"],
                changed,
            )
        return None

    @staticmethod
    def calculate_column_diff(
        left: List[Column], right: List[Column]
    ) -> Dict[str, List[str]]:
        removed: List[str] = []
        added: List[str] = []
        right_columns_dict: Dict[str, Column] = {c.name.root: c for c in right}
        for column in left:
            table2_column = right_columns_dict.get(column.name.root)
            if table2_column is None:
                removed.append(column.name.root)
                continue
            del right_columns_dict[column.name.root]
        added.extend(right_columns_dict.keys())
        return {
            "removed": removed,
            "added": added,
        }

    def column_validation_result(
        self, removed: List[str], added: List[str], changed: List[str]
    ) -> TestCaseResult:
        """Build the result for a column validation result. Messages will only be added
        for non-empty categories. Values will be populated reported for all categories.

        Args:
            removed: List of removed columns
            added: List of added columns
            changed: List of changed columns

        Returns:
            TestCaseResult: The result of the column validation with a meaningful message
        """
        message = (
            f"Tables have {sum(map(len, [removed, added, changed]))} different columns:"
        )
        if removed:
            message += f"\n  Removed columns: {','.join(removed)}\n"
        if added:
            message += f"\n  Added columns: {','.join(added)}\n"
        if changed:
            message += "\n  Changed columns:"
            for col in changed:
                col1 = next(
                    c for c in self.runtime_params.table1.columns if c.name.root == col
                )
                col2 = next(
                    c for c in self.runtime_params.table2.columns if c.name.root == col
                )
                message += (
                    f"\n    {col}: {col1.dataType.value} -> {col2.dataType.value}"
                )
        return TestCaseResult(
            timestamp=self.execution_date,  # type: ignore
            testCaseStatus=TestCaseStatus.Failed,
            result=message,
            testResultValue=[
                TestResultValue(name="removedColumns", value=str(len(removed))),
                TestResultValue(name="addedColumns", value=str(len(added))),
                TestResultValue(name="changedColumns", value=str(len(changed))),
            ],
        )
