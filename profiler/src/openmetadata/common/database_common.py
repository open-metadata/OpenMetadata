#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#   http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
from __future__ import annotations

import logging
import re
from abc import abstractmethod
from datetime import date, datetime
from numbers import Number
from typing import List, Optional
from urllib.parse import quote_plus

from pydantic import BaseModel
from sqlalchemy import create_engine

from openmetadata.common.config import ConfigModel, IncludeFilterPattern
from openmetadata.common.database import Database
from openmetadata.profiler.profiler_metadata import Column, SupportedDataType

logger = logging.getLogger(__name__)


class SQLConnectionConfig(ConfigModel):
    username: Optional[str] = None
    password: Optional[str] = None
    host_port: str
    database: Optional[str] = None
    db_schema: Optional[str] = None
    scheme: str
    service_name: str
    service_type: str
    options: dict = {}
    profiler_date: Optional[str] = datetime.now().strftime("%Y-%m-%d")
    profiler_offset: Optional[int] = 0
    profiler_limit: Optional[int] = 50000
    filter_pattern: IncludeFilterPattern = IncludeFilterPattern.allow_all()

    @abstractmethod
    def get_connection_url(self):
        url = f"{self.scheme}://"
        if self.username is not None:
            url += f"{quote_plus(self.username)}"
            if self.password is not None:
                url += f":{quote_plus(self.password)}"
            url += "@"
        url += f"{self.host_port}"
        if self.database:
            url += f"/{self.database}"
        logger.info(url)
        return url


_numeric_types = [
    "SMALLINT",
    "INTEGER",
    "BIGINT",
    "DECIMAL",
    "NUMERIC",
    "REAL",
    "DOUBLE PRECISION",
    "SMALLSERIAL",
    "SERIAL",
    "BIGSERIAL",
]

_text_types = ["CHARACTER VARYING", "CHARACTER", "CHAR", "VARCHAR" "TEXT"]

_time_types = [
    "TIMESTAMP",
    "DATE",
    "TIME",
    "TIMESTAMP WITH TIME ZONE",
    "TIMESTAMP WITHOUT TIME ZONE",
    "TIME WITH TIME ZONE",
    "TIME WITHOUT TIME ZONE",
]


def register_custom_type(
    data_types: List[str], type_category: SupportedDataType
) -> None:
    if type_category == SupportedDataType.TIME:
        _time_types.extend(data_types)
    elif type_category == SupportedDataType.TEXT:
        _text_types.extend(data_types)
    elif type_category == SupportedDataType.NUMERIC:
        _numeric_types.extend(data_types)
    else:
        raise Exception(f"Unsupported {type_category}")


class SQLExpressions(BaseModel):
    count_all_expr: str = "COUNT(*)"
    count_expr: str = "COUNT({})"
    distinct_expr: str = "DISTINCT({})"
    min_expr: str = "MIN({})"
    max_expr: str = "MAX({})"
    length_expr: str = "LENGTH({})"
    avg_expr: str = "AVG({})"
    sum_expr: str = "SUM({})"
    variance_expr: str = "VARIANCE({})"
    stddev_expr: str = "STDDEV({})"
    limit_expr: str = "LIMIT {}"
    count_conditional_expr: str = "COUNT(CASE WHEN {} THEN 1 END)"
    conditional_expr: str = "CASE WHEN {} THEN {} END"
    equal_expr: str = "{}  == {}"
    less_than_expr: str = "{} < {}"
    less_than_or_equal_expr: str = "{} <= {}"
    greater_than_expr: str = "{} > {}"
    greater_than_or_equal_expr: str = "{} >= {}"
    var_in_expr: str = "{} in {}"
    regex_like_pattern_expr: str = "REGEXP_LIKE({}, '{}')"
    contains_expr: str = "{} LIKE '%{}%'"
    starts_with_expr: str = "{} LIKE '%{}'"
    ends_with_expr: str = "{} LIKE '{}%'"

    @staticmethod
    def escape_metacharacters(value: str):
        return re.sub(r"(\\.)", r"\\\1", value)

    def literal_number(self, value: Number):
        if value is None:
            return None
        return str(value)

    def literal_string(self, value: str):
        if value is None:
            return None
        return "'" + self.escape_metacharacters(value) + "'"

    def literal_list(self, l: list):
        if l is None:
            return None
        return "(" + (",".join([self.literal(e) for e in l])) + ")"

    def count(self, expr: str):
        return self.count_expr.format(expr)

    def distinct(self, expr: str):
        return self.distinct_expr.format(expr)

    def min(self, expr: str):
        return self.min_expr.format(expr)

    def max(self, expr: str):
        return self.max_expr.format(expr)

    def length(self, expr: str):
        return self.length_expr.format(expr)

    def avg(self, expr: str):
        return self.avg_expr.format(expr)

    def sum(self, expr: str):
        return self.sum_expr.format(expr)

    def variance(self, expr: str):
        return self.variance_expr.format(expr)

    def stddev(self, expr: str):
        return self.stddev_expr.format(expr)

    def limit(self, expr: str):
        return self.limit_expr.format(expr)

    def regex_like(self, expr: str, pattern: str):
        return self.regex_like_pattern_expr.format(expr, pattern)

    def equal(self, left: str, right: str):
        if right == "null":
            return f"{left} IS NULL"
        else:
            return self.equal_expr.format(right, left)

    def less_than(self, left, right):
        return self.less_than_expr.format(left, right)

    def less_than_or_equal(self, left, right):
        return self.less_than_or_equal_expr.format(left, right)

    def greater_than(self, left, right):
        return self.greater_than_expr.format(left, right)

    def greater_than_or_equal(self, left, right):
        return self.greater_than_or_equal_expr.format(left, right)

    def var_in(self, left, right):
        return self.var_in_expr.format(left, right)

    def contains(self, value, substring):
        return self.contains_expr.format(value, substring)

    def starts_with(self, value, substring):
        return self.starts_with_expr.format(value, substring)

    def ends_with(self, value, substring):
        return self.ends_with_expr.format(value, substring)

    def count_conditional(self, condition: str):
        return self.count_conditional_expr.format(condition)

    def conditional(self, condition: str, expr: str):
        return self.conditional_expr.format(condition, expr)

    def literal_date_expr(self, date_expr: date):
        date_string = date_expr.strftime("%Y-%m-%d")
        return f"DATE '{date_string}'"

    def literal(self, o: object):
        if isinstance(o, Number):
            return self.literal_number(o)
        elif isinstance(o, str):
            return self.literal_string(o)
        elif isinstance(o, list) or isinstance(o, set) or isinstance(o, tuple):
            return self.literal_list(o)
        raise RuntimeError(f"Cannot convert type {type(o)} to a SQL literal: {o}")

    def list_expr(self, column: Column, values: List[str]) -> str:
        if column.is_text():
            sql_values = [self.literal_string(value) for value in values]
        elif column.is_number():
            sql_values = [self.literal_number(value) for value in values]
        else:
            raise RuntimeError(
                f"Couldn't format list {str(values)} for column {str(column)}"
            )
        return "(" + ",".join(sql_values) + ")"


class DatabaseCommon(Database):
    data_type_varchar_255 = "VARCHAR(255)"
    data_type_integer = "INTEGER"
    data_type_bigint = "BIGINT"
    data_type_decimal = "REAL"
    data_type_date = "DATE"
    config: SQLConnectionConfig = None
    sql_exprs: SQLExpressions = SQLExpressions()

    def __init__(self, config: SQLConnectionConfig):
        self.config = config
        self.connection_string = self.config.get_connection_url()
        self.engine = create_engine(self.connection_string, **self.config.options)
        self.connection = self.engine.raw_connection()

    @classmethod
    def create(cls, config_dict: dict):
        pass

    def table_metadata_query(self, table_name: str) -> str:
        pass

    def qualify_table_name(self, table_name: str) -> str:
        return table_name

    def qualify_column_name(self, column_name: str):
        return column_name

    def is_text(self, column_type: str):
        return column_type.upper() in _text_types

    def is_number(self, column_type: str):
        return column_type.upper() in _numeric_types

    def is_time(self, column_type: str):
        return column_type.upper() in _time_types

    def sql_fetchone(self, sql: str) -> tuple:
        """
        Only returns the tuple obtained by cursor.fetchone()
        """
        return self.sql_fetchone_description(sql)[0]

    def sql_fetchone_description(self, sql: str) -> tuple:
        """
        Returns a tuple with 2 elements:
        1) the tuple obtained by cursor.fetchone()
        2) the cursor.description
        """
        cursor = self.connection.cursor()
        try:
            logger.debug(f"Executing SQL query: \n{sql}")
            start = datetime.now()
            cursor.execute(sql)
            row_tuple = cursor.fetchone()
            description = cursor.description
            delta = datetime.now() - start
            logger.debug(f"SQL took {str(delta)}")
            return row_tuple, description
        finally:
            cursor.close()

    def sql_fetchall(self, sql: str) -> List[tuple]:
        """
        Only returns the tuples obtained by cursor.fetchall()
        """
        return self.sql_fetchall_description(sql)[0]

    def sql_fetchall_description(self, sql: str) -> tuple:
        """
        Returns a tuple with 2 elements:
        1) the tuples obtained by cursor.fetchall()
        2) the cursor.description
        """
        cursor = self.connection.cursor()
        try:
            logger.debug(f"Executing SQL query: \n{sql}")
            start = datetime.now()
            cursor.execute(sql)
            rows = cursor.fetchall()
            delta = datetime.now() - start
            logger.debug(f"SQL took {str(delta)}")
            return rows, cursor.description
        finally:
            cursor.close()

    def close(self):
        if self.connection:
            try:
                self.connection.close()
            except Exception as e:
                logger.error(f"Closing connection failed: {str(e)}")
