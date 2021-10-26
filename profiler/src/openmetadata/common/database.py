#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#   http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
import re
from abc import ABCMeta, abstractmethod
from dataclasses import dataclass
from enum import Enum
from numbers import Number
from sqlite3.dbapi2 import Date
from typing import List, Optional

from openmetadata.profiler.profiler_metadata import Column


class Closeable:
    @abstractmethod
    def close(self):
        pass


class SupportedDataType(Enum):
    NUMERIC = 1
    TEXT = 2
    TIME = 3


@dataclass
class Database(Closeable, metaclass=ABCMeta):
    @classmethod
    @abstractmethod
    def create(cls, config_dict: dict) -> "Database":
        pass

    @abstractmethod
    def table_metadata_query(self, table_name: str) -> str:
        pass

    @abstractmethod
    def is_text(self, column_type: str):
        pass

    @abstractmethod
    def is_number(self, column_type: str):
        pass

    @abstractmethod
    def is_time(self, column_type: str):
        pass

    @abstractmethod
    def sql_expr_count_all(self) -> str:
        pass

    @abstractmethod
    def sql_expr_count_conditional(self, condition: str):
        pass

    @abstractmethod
    def sql_expr_conditional(self, condition: str, expr: str):
        pass

    @abstractmethod
    def sql_expr_count(self, expr):
        pass

    @abstractmethod
    def sql_expr_distinct(self, expr):
        pass

    @abstractmethod
    def sql_expr_min(self, expr):
        pass

    @abstractmethod
    def sql_expr_length(self, expr):
        pass

    @abstractmethod
    def sql_expr_min(self, expr: str):
        pass

    @abstractmethod
    def sql_expr_max(self, expr: str):
        pass

    @abstractmethod
    def sql_expr_avg(self, expr: str):
        pass

    @abstractmethod
    def sql_expr_sum(self, expr: str):
        pass

    @abstractmethod
    def sql_expr_variance(self, expr: str):
        pass

    @abstractmethod
    def sql_expr_stddev(self, expr: str):
        pass

    @abstractmethod
    def sql_expr_regexp_like(self, expr: str, pattern: str):
        pass

    @abstractmethod
    def sql_expr_limit(self, count):
        pass

    @abstractmethod
    def sql_select_with_limit(self, table_name, count):
        pass

    @abstractmethod
    def sql_expr_list(self, column: Column, values: List[str]) -> str:
        pass

    @abstractmethod
    def sql_expr_cast_text_to_number(self, quoted_column_name, validity_format):
        pass

    @abstractmethod
    def literal_number(self, value: Number):
        pass

    @abstractmethod
    def literal_string(self, value: str):
        pass

    @abstractmethod
    def literal_list(self, l: list):
        pass

    @abstractmethod
    def literal_date(self, date: Date):
        pass

    @abstractmethod
    def literal(self, o: object):
        if isinstance(o, Number):
            return self.literal_number(o)
        elif isinstance(o, str):
            return self.literal_string(o)
        elif isinstance(o, list) or isinstance(o, set) or isinstance(o, tuple):
            return self.literal_list(o)
        raise RuntimeError(f"Cannot convert type {type(o)} to a SQL literal: {o}")

    @abstractmethod
    def qualify_table_name(self, table_name: str) -> str:
        return table_name

    @abstractmethod
    def qualify_column_name(self, column_name: str):
        return column_name

    @abstractmethod
    def qualify_writable_table_name(self, table_name: str) -> str:
        return table_name

    @abstractmethod
    def qualify_regex(self, regex):
        return regex

    @abstractmethod
    def qualify_string(self, value: str):
        return value

    @staticmethod
    def escape_metacharacters(value: str):
        return re.sub(r"(\\.)", r"\\\1", value)

    @abstractmethod
    def sql_declare_string_column(self, column_name):
        return f"{column_name} {self.data_type_varchar_255}"

    @abstractmethod
    def sql_declare_integer_column(self, column_name):
        return f"{column_name} {self.data_type_integer}"

    @abstractmethod
    def sql_declare_decimal_column(self, column_name):
        return f"{column_name} {self.data_type_decimal}"

    @abstractmethod
    def sql_declare_big_integer_column(self, column_name):
        return f"{column_name} {self.data_type_bigint}"

    @abstractmethod
    def sql_expression(self, expression_dict: dict, **kwargs):
        pass

    @abstractmethod
    def sql_expr_equal(self, left, right):
        pass

    @abstractmethod
    def sql_expr_less_than(self, left, right):
        pass

    @abstractmethod
    def sql_expr_less_than_or_equal(self, left, right):
        pass

    @abstractmethod
    def sql_expr_greater_than(self, left, right):
        pass

    @abstractmethod
    def sql_expr_greater_than_or_equal(self, left, right):
        pass

    @abstractmethod
    def sql_expr_in(self, left, right):
        pass

    @abstractmethod
    def sql_expr_contains(self, value, substring):
        pass

    @abstractmethod
    def sql_expr_starts_with(self, value, substring):
        pass

    @abstractmethod
    def sql_expr_ends_with(self, value, substring):
        pass

    @abstractmethod
    def get_type_name(self, column_description):
        pass

    @abstractmethod
    def is_connection_error(self, exception):
        pass

    @abstractmethod
    def is_authentication_error(self, exception):
        pass

    @abstractmethod
    def sql_columns_metadata(self, table_name: str) -> List[tuple]:
        pass

    @abstractmethod
    def sql_fetchone(self, sql) -> tuple:
        pass

    @abstractmethod
    def sql_fetchone_description(self, sql) -> tuple:
        pass

    @abstractmethod
    def sql_fetchall(self, sql) -> List[tuple]:
        pass

    @abstractmethod
    def sql_fetchall_description(self, sql) -> tuple:
        pass

    @abstractmethod
    def validate_connection(self):
        pass
