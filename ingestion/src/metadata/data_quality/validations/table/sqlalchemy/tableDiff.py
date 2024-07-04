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
from typing import Iterable, Optional, Tuple
from urllib.parse import urlparse

import data_diff
from data_diff.diff_tables import DiffResultWrapper

from metadata.data_quality.validations.base_test_handler import BaseTestValidator
from metadata.data_quality.validations.mixins.sqa_validator_mixin import (
    SQAValidatorMixin,
)
from metadata.data_quality.validations.models import TableDiffRuntimeParameters
from metadata.data_quality.validations.runtime_param_setter.table_diff_params_setter import (
    TableDiffParamsSetter,
)
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
        except KeyError as e:
            result = TestCaseResult(
                timestamp=self.execution_date,  # type: ignore
                testCaseStatus=TestCaseStatus.Failed,
                result=f"MISMATCHED_COLUMNS: One of the tables is missing the column: '{e}'\n"
                "Use two tables with the same schema or provide the extraColumns parameter.",
                testResultValue=[TestResultValue(name="diffCount", value=str(0))],
            )
            logger.error(result.result)
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
        threshold = self.get_test_case_param_value(
            self.test_case.parameterValues, "threshold", int, default=0
        )
        table_diff_iter = self.get_table_diff()

        if not threshold or self.test_case.computePassedFailedRowCount:
            stats = table_diff_iter.get_stats_dict()
            if stats["total"] > 0:
                logger.debug("Sample of failed rows:")
                for s in islice(self.get_table_diff(), 10):
                    # since the data can contiant sensitive information, we don't want to log it
                    # we can uncomment this line if we must see the data in the logs
                    # logger.debug(s)
                    # by default we will log the data masked
                    logger.debug([s[0], ["*" for _ in s[1]]])
            test_case_result = self.get_test_case_result(
                threshold,
                stats["total"],
                stats["updated"],
                stats["exclusive_A"],
                stats["exclusive_B"],
            )
            count = self._compute_row_count(self.runner, None)  # type: ignore
            test_case_result.passedRows = stats["unchanged"]
            test_case_result.passedRowsPercentage = (
                test_case_result.passedRows / count * 100
            )
            test_case_result.failedRowsPercentage = (
                test_case_result.failedRows / count * 100
            )
            return test_case_result
        return self.get_test_case_result(
            threshold,
            self.calculate_diffs_with_limit(table_diff_iter, threshold),
        )

    def get_table_diff(self) -> DiffResultWrapper:
        """Calls data_diff.diff_tables with the parameters from the test case."""
        table1 = data_diff.connect_to_table(
            self.runtime_params.service1Url, self.runtime_params.table1, self.runtime_params.keyColumns  # type: ignore
        )
        table2 = data_diff.connect_to_table(
            self.runtime_params.service2Url, self.runtime_params.table2, self.runtime_params.keyColumns  # type: ignore
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

    @property
    def _param_name(self):
        return "forbiddenRegex"

    def get_test_case_result(
        self,
        threshold: int,
        total_diffs: int,
        changed: Optional[int] = None,
        removed: Optional[int] = None,
        added: Optional[int] = None,
    ) -> TestCaseResult:
        result_values = [
            TestResultValue(name="diffCount", value=str(total_diffs)),
        ]
        if changed is not None:
            result_values.append(TestResultValue(name="changed", value=str(changed)))
        if removed is not None:
            result_values.append(TestResultValue(name="removed", value=str(removed)))
        if added is not None:
            result_values.append(TestResultValue(name="added", value=str(added)))
        return TestCaseResult(
            timestamp=self.execution_date,  # type: ignore
            testCaseStatus=self.get_test_case_status(
                (threshold or total_diffs) == 0 or total_diffs < threshold
            ),
            result=f"Found {total_diffs} different rows which is more than the threshold of {threshold}",
            failedRows=total_diffs,
            testResultValue=result_values,
            validateColumns=False,
        )

    def _validate_dialects(self):
        for param in ["service1Url", "service2Url"]:
            dialect = urlparse(getattr(self.runtime_params, param)).scheme
            if dialect not in SUPPORTED_DIALECTS:
                raise UnsupportedDialectError(param, dialect)

    def calculate_diffs_with_limit(
        self, diff_iter: Iterable[Tuple[str, Tuple[str, ...]]], limit: int
    ) -> int:
        """Given an iterator of diffs like
        - ('+', (...))
        - ('-', (...))
        ...
        Calculate the total diffs by combining diffs for the same key. This gives an accurate count of the total diffs
        as opposed to self.calculate_diff_num(diff_list)just counting the number of diffs in the list.

        Args:
            diff_iter: iterator returned from the data_diff algorithm

        Returns:
            int: accurate count of the total diffs up to the limit

        """
        len_key_columns = len(self.runtime_params.keyColumns)
        key_set = set()
        # combine diffs on same key to "!"
        for _, values in diff_iter:
            k = values[:len_key_columns]
            if k in key_set:
                continue
            key_set.add(k)
            if len(key_set) > limit:
                len(key_set)
        return len(key_set)
