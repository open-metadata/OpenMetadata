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

from sqlalchemy import create_engine

from openmetadata.common.config import ConfigModel, IncludeFilterPattern
from openmetadata.common.database import Database, SupportedDataType
from openmetadata.profiler.db import (
    sql_fetchall,
    sql_fetchall_description,
    sql_fetchone,
    sql_fetchone_description,
)
from openmetadata.profiler.profiler_metadata import Column

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


class DatabaseCommon(Database):
    data_type_varchar_255 = "VARCHAR(255)"
    data_type_integer = "INTEGER"
    data_type_bigint = "BIGINT"
    data_type_decimal = "REAL"
    data_type_date = "DATE"

    def __init__(self, config: SQLConnectionConfig):
        self.config = config
        self.sql_config = self.config
        self.connection_string = self.sql_config.get_connection_url()
        self.engine = create_engine(self.connection_string, **self.sql_config.options)
        self.connection = self.engine.raw_connection()

    @classmethod
    def create(cls, config_dict: dict):
        pass

    @staticmethod
    def escape_metacharacters(value: str):
        return re.sub(r"(\\.)", r"\\\1", value)

    def table_metadata_query(self, table_name: str) -> str:
        pass

    def is_text(self, column_type: str):
        return column_type.upper() in _text_types

    def is_number(self, column_type: str):
        return column_type.upper() in _numeric_types

    def is_time(self, column_type: str):
        return column_type.upper() in _time_types

    def sql_expr_count_all(self) -> str:
        return "COUNT(*)"

    def sql_expr_count_conditional(self, condition: str):
        return f"COUNT(CASE WHEN {condition} THEN 1 END)"

    def sql_expr_conditional(self, condition: str, expr: str):
        return f"CASE WHEN {condition} THEN {expr} END"

    def sql_expr_count(self, expr):
        return f"COUNT({expr})"

    def sql_expr_distinct(self, expr):
        return f"DISTINCT({expr})"

    def sql_expr_min(self, expr):
        return f"MIN({expr})"

    def sql_expr_length(self, expr):
        return f"LENGTH({expr})"

    def sql_expr_max(self, expr: str):
        return f"MAX({expr})"

    def sql_expr_avg(self, expr: str):
        return f"AVG({expr})"

    def sql_expr_sum(self, expr: str):
        return f"SUM({expr})"

    def sql_expr_variance(self, expr: str):
        return f"VARIANCE({expr})"

    def sql_expr_stddev(self, expr: str):
        return f"STDDEV({expr})"

    def sql_expr_regexp_like(self, expr: str, pattern: str):
        return f"REGEXP_LIKE({expr}, '{self.qualify_regex(pattern)}')"

    def sql_expr_limit(self, count):
        return f"LIMIT {count}"

    def sql_select_with_limit(self, table_name, count):
        return f"SELECT * FROM {table_name} LIMIT {count}"

    def sql_expr_list(self, column: Column, values: List[str]) -> str:
        if self.is_text(column.data_type):
            sql_values = [self.literal_string(value) for value in values]
        elif self.is_number(column.data_type):
            sql_values = [self.literal_number(value) for value in values]
        else:
            raise RuntimeError(
                f"Couldn't format list {str(values)} for column {str(column)}"
            )
        return "(" + ",".join(sql_values) + ")"

    def sql_expr_cast_text_to_number(self, quoted_column_name, validity_format):
        if validity_format == "number_whole":
            return f"CAST({quoted_column_name} AS {self.data_type_decimal})"
        not_number_pattern = self.qualify_regex(r"[^-[0-9]\.\,]")
        comma_pattern = self.qualify_regex(r"\\,")
        return (
            f"CAST(REGEXP_REPLACE(REGEXP_REPLACE({quoted_column_name}, '{not_number_pattern}', ''), "
            f"'{comma_pattern}', '.') AS {self.data_type_decimal})"
        )

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

    def literal_date(self, date: date):
        date_string = date.strftime("%Y-%m-%d")
        return f"DATE '{date_string}'"

    def literal(self, o: object):
        if isinstance(o, Number):
            return self.literal_number(o)
        elif isinstance(o, str):
            return self.literal_string(o)
        elif isinstance(o, list) or isinstance(o, set) or isinstance(o, tuple):
            return self.literal_list(o)
        raise RuntimeError(f"Cannot convert type {type(o)} to a SQL literal: {o}")

    def qualify_table_name(self, table_name: str) -> str:
        return table_name

    def qualify_column_name(self, column_name: str):
        return column_name

    def qualify_writable_table_name(self, table_name: str) -> str:
        return table_name

    def qualify_regex(self, regex):
        return regex

    def qualify_string(self, value: str):
        return value

    def sql_declare_string_column(self, column_name):
        return f"{column_name} {self.data_type_varchar_255}"

    def sql_declare_integer_column(self, column_name):
        return f"{column_name} {self.data_type_integer}"

    def sql_declare_decimal_column(self, column_name):
        return f"{column_name} {self.data_type_decimal}"

    def sql_declare_big_integer_column(self, column_name):
        return f"{column_name} {self.data_type_bigint}"

    def sql_expression(self, expression_dict: dict, **kwargs):
        if expression_dict is None:
            return None
        type = expression_dict["type"]
        if type == "number":
            sql = self.literal_number(expression_dict["value"])
        elif type == "string":
            sql = self.literal_string(expression_dict["value"])
        elif type == "time":
            if expression_dict["scanTime"]:
                sql = self.literal(kwargs["scan_time"])
            else:
                raise RuntimeError(
                    'Unsupported time comparison! Only "scanTime" is supported'
                )
        elif type == "columnValue":
            sql = expression_dict["columnName"]
        elif type == "collection":
            # collection of string or number literals
            value = expression_dict["value"]
            sql = self.literal_list(value)
        elif type == "equals":
            left = self.sql_expression(expression_dict["left"], **kwargs)
            right = self.sql_expression(expression_dict["right"], **kwargs)
            sql = self.sql_expr_equal(left, right)
        elif type == "lessThan":
            left = self.sql_expression(expression_dict["left"], **kwargs)
            right = self.sql_expression(expression_dict["right"], **kwargs)
            sql = self.sql_expr_less_than(left, right)
        elif type == "lessThanOrEqual":
            left = self.sql_expression(expression_dict["left"], **kwargs)
            right = self.sql_expression(expression_dict["right"], **kwargs)
            sql = self.sql_expr_less_than_or_equal(left, right)
        elif type == "greaterThan":
            left = self.sql_expression(expression_dict["left"], **kwargs)
            right = self.sql_expression(expression_dict["right"], **kwargs)
            sql = self.sql_expr_greater_than(left, right)
        elif type == "greaterThanOrEqual":
            left = self.sql_expression(expression_dict["left"], **kwargs)
            right = self.sql_expression(expression_dict["right"], **kwargs)
            sql = self.sql_expr_greater_than_or_equal(left, right)
        elif type == "between":
            clauses = []
            value = self.sql_expression(expression_dict["value"], **kwargs)
            gte = self.literal_number(expression_dict.get("gte"))
            gt = self.literal_number(expression_dict.get("gt"))
            lte = self.literal_number(expression_dict.get("lte"))
            lt = self.literal_number(expression_dict.get("lt"))
            if gte:
                clauses.append(self.sql_expr_less_than_or_equal(gte, value))
            elif gt:
                clauses.append(self.sql_expr_less_than(gt, value))
            if lte:
                clauses.append(self.sql_expr_less_than_or_equal(value, lte))
            elif lt:
                clauses.append(self.sql_expr_less_than(value, lt))
            sql = " AND ".join(clauses)
        elif type == "in":
            left = self.sql_expression(expression_dict["left"], **kwargs)
            right = self.sql_expression(expression_dict["right"], **kwargs)
            sql = self.sql_expr_in(left, right)
        elif type == "contains":
            value = self.sql_expression(expression_dict["left"], **kwargs)
            substring = self.escape_metacharacters(expression_dict["right"]["value"])
            sql = self.sql_expr_contains(value, substring)
        elif type == "startsWith":
            value = self.sql_expression(expression_dict["left"], **kwargs)
            substring = self.escape_metacharacters(expression_dict["right"]["value"])
            sql = self.sql_expr_starts_with(value, substring)
        elif type == "endsWith":
            value = self.sql_expression(expression_dict["left"], **kwargs)
            substring = self.escape_metacharacters(expression_dict["right"]["value"])
            sql = self.sql_expr_ends_with(value, substring)
        elif type == "not":
            sql = (
                "NOT ("
                + self.sql_expression(expression_dict["expression"], **kwargs)
                + ")"
            )
        elif type == "and":
            sql = (
                "("
                + (
                    ") AND (".join(
                        [
                            self.sql_expression(e, **kwargs)
                            for e in expression_dict["andExpressions"]
                        ]
                    )
                )
                + ")"
            )
        elif type == "or":
            sql = (
                "("
                + (
                    ") OR (".join(
                        [
                            self.sql_expression(e, **kwargs)
                            for e in expression_dict["orExpressions"]
                        ]
                    )
                )
                + ")"
            )
        elif type == "null":
            sql = "null"
        else:
            raise RuntimeError(f"Unsupported expression type: {type}")
        return sql

    def sql_expr_equal(self, left, right):
        if right == "null":
            return f"{left} IS NULL"
        else:
            return f"{left} = {right}"

    def sql_expr_less_than(self, left, right):
        return f"{left} < {right}"

    def sql_expr_less_than_or_equal(self, left, right):
        return f"{left} <= {right}"

    def sql_expr_greater_than(self, left, right):
        return f"{left} > {right}"

    def sql_expr_greater_than_or_equal(self, left, right):
        return f"{left} >= {right}"

    def sql_expr_in(self, left, right):
        return f"{left} IN {right}"

    def sql_expr_contains(self, value, substring):
        return value + " LIKE '%" + substring + "%'"

    def sql_expr_starts_with(self, value, substring):
        return value + " LIKE '" + substring + "%'"

    def sql_expr_ends_with(self, value, substring):
        return value + " LIKE '%" + substring + "'"

    def get_type_name(self, column_description):
        return str(column_description[1])

    def is_connection_error(self, exception):
        return False

    def is_authentication_error(self, exception):
        return False

    def sql_fetchone(self, sql) -> tuple:
        return sql_fetchone(self.connection, sql)

    def sql_fetchone_description(self, sql) -> tuple:
        return sql_fetchone_description(self.connection, sql)

    def sql_fetchall(self, sql) -> List[tuple]:
        return sql_fetchall(self.connection, sql)

    def sql_fetchall_description(self, sql) -> tuple:
        return sql_fetchall_description(self.connection, sql)

    def sql_columns_metadata(self, table_name: str) -> List[tuple]:
        return []

    def validate_connection(self):
        pass

    def close(self):
        if self.connection:
            try:
                self.connection.close()
            except Exception as e:
                logger.error(f"Closing connection failed: {str(e)}")
