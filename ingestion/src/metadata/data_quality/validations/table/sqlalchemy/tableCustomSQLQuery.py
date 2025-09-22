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

from typing import Optional, Tuple, cast

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

    def _replace_where_clause(
        self, sql_query: str, partition_expression: str
    ) -> Optional[str]:
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

        where_idx, where_end_idx, insert_before_idx = self._find_clause_positions(
            tokens
        )
        new_tokens = self._build_new_tokens(
            tokens, where_idx, where_end_idx, insert_before_idx, partition_expression
        )

        return "".join(str(token) for token in new_tokens)

    def _find_clause_positions(
        self, tokens: list
    ) -> Tuple[Optional[int], Optional[int], Optional[int]]:
        """Find positions of WHERE clause and insertion points in token list.

        Args:
            tokens: List of parsed SQL tokens

        Returns:
            Tuple of (where_idx, where_end_idx, insert_before_idx)
        """
        where_idx = None
        where_end_idx = None
        insert_before_idx = None
        paren_depth = 0

        for i, token in enumerate(tokens):
            paren_depth = self._update_parentheses_depth(token, paren_depth)

            if isinstance(token, Where) and paren_depth == 0:
                where_idx = i
                where_end_idx = i + 1
                break

            if self._should_insert_before_token(token, insert_before_idx, paren_depth):
                insert_before_idx = i

        return where_idx, where_end_idx, insert_before_idx

    def _update_parentheses_depth(self, token: Token, current_depth: int) -> int:
        """Update parentheses depth based on token content.

        Args:
            token: SQL token to analyze
            current_depth: Current parentheses depth

        Returns:
            Updated parentheses depth
        """
        if token.ttype is None and hasattr(token, "tokens"):
            paren_count = str(token).count("(") - str(token).count(")")
            return current_depth + paren_count
        elif token.value == "(":
            return current_depth + 1
        elif token.value == ")":
            return current_depth - 1
        return current_depth

    def _should_insert_before_token(
        self, token: Token, insert_before_idx: Optional[int], paren_depth: int
    ) -> bool:
        """Check if WHERE clause should be inserted before this token.

        Args:
            token: SQL token to check
            insert_before_idx: Current insertion index (None if not set)
            paren_depth: Current parentheses depth

        Returns:
            True if WHERE should be inserted before this token
        """
        if insert_before_idx is not None or paren_depth != 0:
            return False

        if token.ttype is not Keyword:
            return False

        clause_keywords = {
            "GROUP BY",
            "ORDER BY",
            "HAVING",
            "LIMIT",
            "OFFSET",
            "UNION",
            "EXCEPT",
            "INTERSECT",
        }

        return any(keyword in token.value.upper() for keyword in clause_keywords)

    def _build_new_tokens(
        self,
        tokens: list,
        where_idx: Optional[int],
        where_end_idx: Optional[int],
        insert_before_idx: Optional[int],
        partition_expression: str,
    ) -> list:
        """Build new token list with WHERE clause inserted or replaced.

        Args:
            tokens: Original token list
            where_idx: Index of existing WHERE clause (None if not found)
            where_end_idx: End index of existing WHERE clause
            insert_before_idx: Index to insert WHERE before (None if append)
            partition_expression: WHERE condition expression

        Returns:
            New list of tokens with WHERE clause
        """
        if where_idx is not None:
            return self._replace_existing_where(
                tokens, where_idx, where_end_idx, partition_expression
            )
        elif insert_before_idx is not None:
            return self._insert_where_before_clause(
                tokens, insert_before_idx, partition_expression
            )
        else:
            return self._append_where_clause(tokens, partition_expression)

    def _replace_existing_where(
        self,
        tokens: list,
        where_idx: int,
        where_end_idx: int,
        partition_expression: str,
    ) -> list:
        """Replace existing WHERE clause with new expression.

        Args:
            tokens: Original token list
            where_idx: Index of WHERE clause to replace
            where_end_idx: End index of WHERE clause
            partition_expression: New WHERE condition

        Returns:
            Token list with replaced WHERE clause
        """
        original_where = str(tokens[where_idx])
        trailing_whitespace = self._extract_trailing_whitespace(original_where)

        return (
            tokens[:where_idx]
            + [
                Token(Keyword, "WHERE"),
                Token(None, f" {partition_expression}{trailing_whitespace}"),
            ]
            + tokens[where_end_idx:]
        )

    def _insert_where_before_clause(
        self, tokens: list, insert_before_idx: int, partition_expression: str
    ) -> list:
        """Insert WHERE clause before specified token index.

        Args:
            tokens: Original token list
            insert_before_idx: Index to insert WHERE clause before
            partition_expression: WHERE condition expression

        Returns:
            Token list with WHERE clause inserted
        """
        return (
            tokens[:insert_before_idx]
            + [Token(Keyword, "WHERE"), Token(None, f" {partition_expression} ")]
            + tokens[insert_before_idx:]
        )

    def _append_where_clause(self, tokens: list, partition_expression: str) -> list:
        """Append WHERE clause to end of token list.

        Args:
            tokens: Original token list
            partition_expression: WHERE condition expression

        Returns:
            Token list with WHERE clause appended
        """
        return tokens + [
            Token(None, " "),
            Token(Keyword, "WHERE"),
            Token(None, f" {partition_expression}"),
        ]

    def _extract_trailing_whitespace(self, where_clause: str) -> str:
        """Extract trailing whitespace from WHERE clause string.

        Args:
            where_clause: Original WHERE clause string

        Returns:
            Trailing whitespace string
        """
        if not where_clause.split():
            return ""

        last_word = where_clause.split()[-1]
        where_content_end = where_clause.rfind(last_word) + len(last_word)

        if where_content_end < len(where_clause):
            return where_clause[where_content_end:]

        return ""

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
