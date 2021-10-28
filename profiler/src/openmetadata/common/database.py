#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#   http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

from abc import ABCMeta, abstractmethod
from dataclasses import dataclass
from typing import List


class Closeable:
    @abstractmethod
    def close(self):
        pass


@dataclass
class Database(Closeable, metaclass=ABCMeta):
    @classmethod
    @abstractmethod
    def create(cls, config_dict: dict) -> "Database":
        pass

    @property
    @abstractmethod
    def columns(self):
        pass

    @property
    @abstractmethod
    def sql_exprs(self):
        pass

    @abstractmethod
    def table_column_metadata(self, table: str, schema: str):
        pass

    @abstractmethod
    def qualify_table_name(self, table_name: str) -> str:
        return table_name

    @abstractmethod
    def qualify_column_name(self, column_name: str):
        return column_name

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
    def execute_query(self, sql) -> tuple:
        pass

    @abstractmethod
    def execute_query_columns(self, sql) -> tuple:
        pass

    @abstractmethod
    def execute_query_all(self, sql) -> List[tuple]:
        pass

    @abstractmethod
    def execute_query_all_columns(self, sql) -> tuple:
        pass
