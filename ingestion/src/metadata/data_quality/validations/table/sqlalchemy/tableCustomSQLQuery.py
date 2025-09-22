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

from typing import Optional, cast

import sqlparse
from sqlalchemy import text
from sqlalchemy.sql import func, select
from sqlparse.sql import Statement, Token, Where
from sqlparse.tokens import Keyword

from metadata.data_quality.validations.mixins.sqa_validator_mixin import (
    SQAValidatorMixin,
)
from metadata.data_quality.validations.models import (
    TableCustomSQLQueryRuntimeParameters,
)
from metadata.data_quality.validations.table.base.tableCustomSQLQuery import (
    BaseTableCustomSQLQueryValidator,
    Strategy,
)
from metadata.generated.schema.tests.basic import TestCaseResult
from metadata.profiler.metrics.registry import Metrics
from metadata.profiler.orm.functions.table_metric_computer import TableMetricComputer
from metadata.profiler.processor.runner import QueryRunner
from metadata.utils.helpers import is_safe_sql_query
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class TableCustomSQLQueryValidator(BaseTableCustomSQLQueryValidator, SQAValidatorMixin):
    """Validator for table custom SQL Query test case"""

    def _replace_where_clause(self, sql_query: str, partition_expression: str) -> str:
        """Replace or add WHERE clause in SQL query using sqlparse.

        This method properly handles:
        - Queries with existing WHERE clause (replaces it)
        - Queries without WHERE clause (adds it)
        - Complex queries with joins, subqueries, CTEs
        - Preserves GROUP BY, ORDER BY, LIMIT, etc.

        Args:
            sql_query: Original SQL query
            partition_expression: New WHERE condition (without WHERE keyword)

        Returns:
            Modified SQL query with partition_expression as WHERE clause
        """
        parsed = sqlparse.parse(sql_query)
        if not parsed or len(parsed) == 0:
            return None

        statement: Statement = parsed[0]
        tokens = list(statement.tokens)

        where_idx = None
        where_end_idx = None
        insert_before_idx = None
        paren_depth = 0

        i = 0
        while i < len(tokens):
            token = tokens[i]

            if token.ttype is None and hasattr(token, "tokens"):
                paren_count = str(token).count("(") - str(token).count(")")
                paren_depth += paren_count
            elif token.value == "(":
                paren_depth += 1
            elif token.value == ")":
                paren_depth -= 1

            if isinstance(token, Where) and paren_depth == 0:
                where_idx = i
                where_end_idx = i + 1
                break

            if (
                insert_before_idx is None
                and token.ttype is Keyword
                and any(
                    keyword in token.value.upper()
                    for keyword in (
                        "GROUP BY",
                        "ORDER BY",
                        "HAVING",
                        "LIMIT",
                        "OFFSET",
                        "UNION",
                        "EXCEPT",
                        "INTERSECT",
                    )
                )
                and paren_depth == 0
            ):
                insert_before_idx = i

            i += 1

        if where_idx is not None:
            original_where = str(tokens[where_idx])
            trailing_whitespace = ""

            where_content_end = original_where.rfind(original_where.split()[-1]) + len(
                original_where.split()[-1]
            )
            if where_content_end < len(original_where):
                trailing_whitespace = original_where[where_content_end:]

            new_tokens = (
                tokens[:where_idx]
                + [
                    Token(Keyword, "WHERE"),
                    Token(None, f" {partition_expression}{trailing_whitespace}"),
                ]
                + tokens[where_end_idx:]
            )
        elif insert_before_idx is not None:
            new_tokens = (
                tokens[:insert_before_idx]
                + [Token(Keyword, "WHERE"), Token(None, f" {partition_expression} ")]
                + tokens[insert_before_idx:]
            )
        else:
            new_tokens = tokens + [
                Token(None, " "),
                Token(Keyword, "WHERE"),
                Token(None, f" {partition_expression}"),
            ]

        return "".join(str(token) for token in new_tokens)

    def run_validation(self) -> TestCaseResult:
        """Run validation for the given test case

        Returns:
            TestCaseResult:
        """
        self.runtime_params = self.get_runtime_parameters(
            TableCustomSQLQueryRuntimeParameters
        )
        return super().run_validation()

    def _run_results(self, sql_expression: str, strategy: Strategy = Strategy.ROWS):
        """compute result of the test case"""
        if not is_safe_sql_query(sql_expression):
            raise RuntimeError(f"SQL expression is not safe\n\n{sql_expression}")
        try:
            cursor = self.runner._session.execute(  # pylint: disable=protected-access
                text(sql_expression)
            )
            if strategy == Strategy.COUNT:
                result = cursor.scalar()
                if not isinstance(result, int):
                    raise ValueError(
                        f"When using COUNT strategy, the result must be an integer. Received: {type(result)}\n"
                        "Example: SELECT COUNT(*) FROM table_name WHERE my_value IS NOT NULL"
                    )
                return result
            return cursor.fetchall()
        except Exception as exc:
            self.runner._session.rollback()  # pylint: disable=protected-access
            raise exc

    def compute_row_count(self) -> Optional[int]:
        """Compute row count for the given column

        Raises:
            NotImplementedError:
        """
        partition_expression = next(
            (
                param.value
                for param in self.test_case.parameterValues
                if param.name == "partitionExpression"
            ),
            None,
        )
        if partition_expression:
            custom_sql = self.get_test_case_param_value(
                self.test_case.parameterValues,  # type: ignore
                "sqlExpression",
                str,
            )

            if custom_sql:
                modified_query = self._replace_where_clause(
                    custom_sql, partition_expression
                )
                if modified_query is None:
                    return None
                count_query = f"SELECT COUNT(*) FROM ({modified_query}) AS test_results"

                try:
                    result = self.runner.session.execute(text(count_query)).scalar()
                    return result
                except Exception as exc:
                    logger.error(
                        "Failed to execute custom SQL with partition expression. "
                        f"Query: {count_query}\n"
                        f"Error: {exc}\n",
                        exc_info=True,
                    )
                    self.runner.session.rollback()
                    raise exc
            else:
                stmt = (
                    select(func.count())
                    .select_from(self.runner.table)
                    .filter(text(partition_expression))
                )
                return self.runner.session.execute(stmt).scalar()

        self.runner = cast(QueryRunner, self.runner)
        dialect = self.runner._session.get_bind().dialect.name
        table_metric_computer: TableMetricComputer = TableMetricComputer(
            dialect,
            runner=self.runner,
            metrics=[Metrics.ROW_COUNT],
            conn_config=self.runtime_params.conn_config,
            entity=self.runtime_params.entity,
        )
        row = table_metric_computer.compute()
        if row:
            return dict(row).get(Metrics.ROW_COUNT.value.name())
        return None
