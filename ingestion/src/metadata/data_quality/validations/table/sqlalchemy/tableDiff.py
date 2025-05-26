#  Copyright 2024 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
# pylint: disable=missing-module-docstring
import logging
import random
import string
import traceback
from decimal import Decimal
from functools import reduce
from itertools import islice
from typing import Dict, Iterable, List, Optional, Tuple, cast
from urllib.parse import urlparse

import data_diff
import sqlalchemy.types
from data_diff.diff_tables import DiffResultWrapper
from data_diff.errors import DataDiffMismatchingKeyTypesError
from data_diff.utils import ArithAlphanumeric, CaseInsensitiveDict
from sqlalchemy import Column as SAColumn
from sqlalchemy import literal, select
from sqlalchemy.engine import make_url

from metadata.data_quality.validations import utils
from metadata.data_quality.validations.base_test_handler import BaseTestValidator
from metadata.data_quality.validations.mixins.sqa_validator_mixin import (
    SQAValidatorMixin,
)
from metadata.data_quality.validations.models import (
    TableDiffRuntimeParameters,
    TableParameter,
)
from metadata.generated.schema.entity.data.table import Column, ProfileSampleType
from metadata.generated.schema.entity.services.connections.database.sapHanaConnection import (
    SapHanaScheme,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.generated.schema.tests.basic import (
    TestCaseResult,
    TestCaseStatus,
    TestResultValue,
)
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.orm.converter.base import build_orm_col
from metadata.profiler.orm.functions.md5 import MD5
from metadata.profiler.orm.functions.substr import Substr
from metadata.profiler.orm.registry import Dialects, PythonDialects
from metadata.utils.collections import CaseInsensitiveList
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


def build_sample_where_clause(
    table: TableParameter, key_columns: List[str], salt: str, hex_nounce: str
) -> str:
    sql_alchemy_columns = [
        build_orm_col(i, c, table.database_service_type)
        for i, c in enumerate(table.columns)
        if c.name.root in key_columns
    ]
    reduced_concat = reduce(
        lambda c1, c2: c1.concat(c2), sql_alchemy_columns + [literal(salt)]
    )
    sqa_dialect = make_url(
        f"{PythonDialects[table.database_service_type.name].value}://"
    ).get_dialect()
    return str(
        select()
        .filter(
            Substr(
                MD5(reduced_concat),
                1,
                8,
            )
            < hex_nounce
        )
        .whereclause.compile(
            dialect=sqa_dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )


def compile_and_clauses(elements) -> str:
    """Compile a list of elements into a string with 'and' clauses.

    Args:
        elements: A string or a list of strings or lists

    Returns:
        A string with 'and' clauses

    Raises:
        ValueError: If the input is not a string or a list

    Examples:
        >>> compile_and_clauses("a")
        'a'
        >>> compile_and_clauses(["a", "b"])
        'a and b'
        >>> compile_and_clauses([["a", "b"], "c"])
        '(a and b) and c'
    """
    if isinstance(elements, str):
        return elements
    if isinstance(elements, list):
        if len(elements) == 1:
            return compile_and_clauses(elements[0])
        return " and ".join(
            (
                f"({compile_and_clauses(e)})"
                if isinstance(e, list)
                else compile_and_clauses(e)
            )
            for e in elements
        )
    raise ValueError("Input must be a string or a list")


class UnsupportedDialectError(Exception):
    def __init__(self, param: str, dialect: str):
        super().__init__(f"Unsupported dialect in param {param}: {dialect}")


def masked(s: str, mask: bool = True) -> str:
    """Mask a string if masked is True otherwise return the string.
    Only for development purposes, do not use in production.
    Change it False if you want to see the data in the logs.

    Args:
        s: string to mask
        mask: boolean to mask the string

    Returns:
        masked string if mask is True otherwise return the string
    """
    return "***" if mask else s


def is_numeric(t: type) -> bool:
    """Check if a type is numeric.

    Args:
        t: type to check

    Returns:
        True if the type is numeric otherwise False
    """
    return t in [int, float, Decimal]


class TableDiffValidator(BaseTestValidator, SQAValidatorMixin):
    """
    Compare two tables and fail if the number of differences exceeds a threshold
    """

    runtime_params: TableDiffRuntimeParameters

    def run_validation(self) -> TestCaseResult:
        self.runtime_params = self.get_runtime_parameters(TableDiffRuntimeParameters)
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
                # depending on the data, this require scanning a lot of data
                # so we only log the sample in debug mode. data can be sensitive
                # so it is masked by default
                for s in islice(
                    self.safe_table_diff_iterator(),
                    10 if logger.level <= logging.DEBUG else 0,
                ):
                    logger.debug("%s", str([s[0]] + [masked(st) for st in s[1]]))
            test_case_result = self.get_row_diff_test_case_result(
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
        return self.get_row_diff_test_case_result(
            threshold,
            self.calculate_diffs_with_limit(table_diff_iter, threshold),
        )

    def get_incomparable_columns(self) -> List[str]:
        """Get the columns that have types that are not comparable between the two tables. For example
        a column that is a string in one table and an integer in the other.

        Returns:
            List[str]: A list of column names that have incomparable types
        """
        table1 = data_diff.connect_to_table(
            self.runtime_params.table1.serviceUrl,
            self.runtime_params.table1.path,
            self.runtime_params.keyColumns,
            extra_columns=self.runtime_params.extraColumns,
            case_sensitive=self.get_case_sensitive(),
            key_content=self.runtime_params.table1.privateKey.get_secret_value()
            if self.runtime_params.table1.privateKey
            else None,
            private_key_passphrase=self.runtime_params.table1.passPhrase.get_secret_value()
            if self.runtime_params.table1.passPhrase
            else None,
        ).with_schema()
        table2 = data_diff.connect_to_table(
            self.runtime_params.table2.serviceUrl,
            self.runtime_params.table2.path,
            self.runtime_params.keyColumns,
            extra_columns=self.runtime_params.extraColumns,
            case_sensitive=self.get_case_sensitive(),
            key_content=self.runtime_params.table2.privateKey.get_secret_value()
            if self.runtime_params.table2.privateKey
            else None,
            private_key_passphrase=self.runtime_params.table2.passPhrase.get_secret_value()
            if self.runtime_params.table2.passPhrase
            else None,
        ).with_schema()
        result = []
        for column in table1.key_columns + table1.extra_columns:
            col1 = table1._schema.get(column)  # pylint: disable=protected-access
            if col1 is None:
                # Skip columns that are not in the first table. We cover this case in get_changed_added_columns.
                continue
            col2 = table2._schema.get(column)  # pylint: disable=protected-access
            if col2 is None:
                # Skip columns that are not in the second table. We cover this case in get_changed_added_columns.
                continue
            col1_type = self._get_column_python_type(col1)
            col2_type = self._get_column_python_type(col2)
            if is_numeric(col1_type) and is_numeric(col2_type):
                continue
            if col1_type != col2_type:
                result.append(column)
        return result

    @staticmethod
    def _get_column_python_type(column: SAColumn):
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
        left_where, right_where = self.sample_where_clause()
        table1 = data_diff.connect_to_table(
            self.runtime_params.table1.serviceUrl,
            self.runtime_params.table1.path,
            self.runtime_params.keyColumns,  # type: ignore
            case_sensitive=self.get_case_sensitive(),
            where=left_where,
            key_content=self.runtime_params.table1.privateKey.get_secret_value()
            if self.runtime_params.table1.privateKey
            else None,
            private_key_passphrase=self.runtime_params.table1.passPhrase.get_secret_value()
            if self.runtime_params.table1.passPhrase
            else None,
        )
        table2 = data_diff.connect_to_table(
            self.runtime_params.table2.serviceUrl,
            self.runtime_params.table2.path,
            self.runtime_params.keyColumns,  # type: ignore
            case_sensitive=self.get_case_sensitive(),
            where=right_where,
            key_content=self.runtime_params.table1.privateKey.get_secret_value()
            if self.runtime_params.table1.privateKey
            else None,
            private_key_passphrase=self.runtime_params.table1.passPhrase.get_secret_value()
            if self.runtime_params.table1.passPhrase
            else None,
        )
        data_diff_kwargs = {
            "key_columns": self.runtime_params.keyColumns,
            "extra_columns": self.runtime_params.extraColumns,
            "where": self.get_where(),
        }
        logger.debug(
            "Calling table diff with parameters: table1=%s, table2=%s, kwargs=%s",
            table1.table_path,
            table2.table_path,
            ",".join(f"{k}={v}" for k, v in data_diff_kwargs.items()),
        )
        return data_diff.diff_tables(table1, table2, **data_diff_kwargs)  # type: ignore

    def get_where(self) -> Optional[str]:
        """Returns the where clause from the test case parameters or None if it is a blank string."""
        return self.runtime_params.whereClause or None

    def sample_where_clause(self) -> Tuple[Optional[str], Optional[str]]:
        """We use a where clause to sample the data for the diff. This is useful because with data diff
        we do not have access to the underlying 'SELECT' statement. This method generates a where clause
        that selects a random sample of the data based on the profile sample configuration.
        The method uses the md5 hash of the key columns and a random salt to select a random sample of the data.
        This ensures that the same data is selected from the two tables of the comparison.

        Example:
            -- Table 1 --  | -- Table 2 --
            id | name      | id | name
            1  | Alice     | 1  | Alice
            2  | Bob       | 2  | Bob
            3  | Charlie   | 3  | Charlie
            4  | David     | 4  | Edward
            5  | Edward    | 6  | Frank

        If we want a sample of 20% of the data, the where clause will intend to select one of the rows
        on Table 1 and the hash will ensure that the same row is selected on Table 2. We want to avoid selecting rows
        with different ids because the comparison will not be sensible.
        """
        if (
            # no sample configuration
            self.runtime_params.table_profile_config is None
            or self.runtime_params.table_profile_config.profileSample is None
            # sample is 100% or in other words no sample is required
            or (
                self.runtime_params.table_profile_config.profileSampleType
                == ProfileSampleType.PERCENTAGE
                and self.runtime_params.table_profile_config.profileSample == 100
            )
        ):
            return None, None
        if DatabaseServiceType.Mssql in [
            self.runtime_params.table1.database_service_type,
            self.runtime_params.table2.database_service_type,
        ]:
            logger.warning("Sampling not supported in MSSQL. Skipping sampling.")
            return None, None
        nounce = self.calculate_nounce()
        # SQL MD5 returns a 32 character hex string even with leading zeros so we need to
        # pad the nounce to 8 characters in preserve lexical order.
        # example: SELECT md5('j(R1wzR*y[^GxWJ5B>L{-HLETRD');
        hex_nounce = hex(nounce)[2:].rjust(8, "0")
        # TODO: using strings for this is sub-optimal. But using bytes buffers requires a by-database
        # implementaiton. We can use this as default and add database specific implementations as the
        # need arises.
        salt = "".join(
            random.choices(string.ascii_letters + string.digits, k=5)
        )  # 1 / ~62^5 should be enough entropy. Use letters and digits to avoid messing with SQL syntax
        key_columns = (
            CaseInsensitiveList(self.runtime_params.keyColumns)
            if not self.get_case_sensitive()
            else self.runtime_params.keyColumns
        )
        return tuple(
            build_sample_where_clause(table, key_columns, salt, hex_nounce)
            for table in [self.runtime_params.table1, self.runtime_params.table2]
        )

    def calculate_nounce(self, max_nounce=2**32 - 1) -> int:
        """Calculate the nounce based on the profile sample configuration. The nounce is
        the sample fraction projected to a number on a scale of 0 to max_nounce"""
        if (
            self.runtime_params.table_profile_config.profileSampleType
            == ProfileSampleType.PERCENTAGE
        ):
            return int(
                max_nounce
                * self.runtime_params.table_profile_config.profileSample
                / 100
            )
        if (
            self.runtime_params.table_profile_config.profileSampleType
            == ProfileSampleType.ROWS
        ):
            row_count = self.get_total_row_count()
            if row_count is None:
                raise ValueError("Row count is required for ROWS profile sample type")
            return int(
                max_nounce
                * (self.runtime_params.table_profile_config.profileSample / row_count)
            )
        raise ValueError("Invalid profile sample type")

    def get_row_diff_test_case_result(
        self,
        threshold: int,
        total_diffs: int,
        changed: Optional[int] = None,
        removed: Optional[int] = None,
        added: Optional[int] = None,
    ) -> TestCaseResult:
        """Build a test case result for a row diff test. If the number of differences is less than the threshold,
        the test will pass, otherwise it will fail. The result will contain the number of added, removed, and changed
        rows, as well as the total number of differences.

        Args:
            threshold: The maximum number of differences allowed before the test fails
            total_diffs: The total number of differences between the tables
            changed: The number of rows that have been changed
            removed: The number of rows that have been removed
            added: The number of rows that have been added

        Returns:
            TestCaseResult: The result of the row diff test
        """
        return TestCaseResult(
            timestamp=self.execution_date,  # type: ignore
            testCaseStatus=self.get_test_case_status(
                (threshold or total_diffs) == 0 or total_diffs < threshold
            ),
            result=f"Found {total_diffs} different rows which is more than the threshold of {threshold}",
            failedRows=total_diffs,
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
        """Get the column diff between the two tables. If there are no differences, return None."""
        removed, added = self.get_changed_added_columns(
            self.runtime_params.table1.columns,
            self.runtime_params.table2.columns,
            self.get_case_sensitive(),
        )
        changed = self.get_incomparable_columns()
        if removed or added or changed:
            return self.column_validation_result(
                removed,
                added,
                changed,
            )
        return None

    @staticmethod
    def get_changed_added_columns(
        left: List[Column], right: List[Column], case_sensitive: bool
    ) -> Optional[Tuple[List[str], List[str]]]:
        """Given a list of columns from two tables, return the columns that are removed and added.

        Args:
            left: List of columns from the first table
            right: List of columns from the second table

        Returns:
            A tuple of lists containing the removed and added columns or None if there are no differences
        """
        removed: List[str] = []
        added: List[str] = []
        right_columns_dict: Dict[str, Column] = {c.name.root: c for c in right}
        if not case_sensitive:
            right_columns_dict = cast(
                Dict[str, Column], CaseInsensitiveDict(right_columns_dict)
            )
        for column in left:
            table2_column = right_columns_dict.get(column.name.root)
            if table2_column is None:
                removed.append(column.name.root)
                continue
            del right_columns_dict[column.name.root]
        added.extend(right_columns_dict.keys())
        return removed, added

    def column_validation_result(
        self,
        removed: List[str],
        added: List[str],
        changed: List[str],
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
            table1_columns = {
                c.name.root: c for c in self.runtime_params.table1.columns
            }
            table2_columns = {
                c.name.root: c for c in self.runtime_params.table2.columns
            }
            if not self.get_case_sensitive():
                table1_columns = CaseInsensitiveDict(table1_columns)
                table2_columns = CaseInsensitiveDict(table2_columns)
            for col in changed:
                col1 = table1_columns[col]
                col2 = table2_columns[col]
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

    def safe_table_diff_iterator(self) -> DiffResultWrapper:
        """A safe iterator object which properly closes the diff object when the generator is exhausted.
        Otherwise the data_diff library will continue to hold the connection open and eventually
        raise a KeyError.
        """
        gen = self.get_table_diff()
        try:
            yield from gen
        finally:
            try:
                gen.diff.close()
            except KeyError as ex:
                if str(ex) == "2":
                    # This is a known issue in data_diff where the diff object is closed
                    pass

    def get_case_sensitive(self):
        return utils.get_bool_test_case_param(
            self.test_case.parameterValues, "caseSensitiveColumns"
        )

    def get_row_count(self) -> Optional[int]:
        return self._compute_row_count(self.runner, None)

    def get_total_row_count(self) -> Optional[int]:
        row_count = Metrics.ROW_COUNT()
        try:
            row = self.runner.select_first_from_table(row_count.fn())
            return dict(row).get(Metrics.ROW_COUNT.name)
        except Exception as e:
            logger.error(f"Error getting row count: {e}")
            return None
