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
"""
NoSQL adaptor for the NoSQL profiler.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Union  # noqa: UP035

from metadata.generated.schema.entity.data.table import Column, Table
from metadata.utils.sqa_like_column import SQALikeColumn


class NoSQLAdaptor(ABC):
    """
    NoSQL adaptor for the NoSQL profiler. This class implememts the required methods for retreiving data from a NoSQL
    database.
    """

    @abstractmethod
    def item_count(self, table: Table) -> int:
        raise NotImplementedError

    @abstractmethod
    def scan(self, table: Table, columns: List[Column], limit: int) -> List[Dict[str, any]]:  # noqa: UP006
        pass

    def query(self, table: Table, columns: List[Column], query: any, limit: int) -> List[Dict[str, any]]:  # noqa: UP006
        raise NotImplementedError

    def get_aggregates(
        self,
        table: Table,
        column: SQALikeColumn,
        aggregate_functions: List[any],  # noqa: UP006
    ) -> Dict[str, Union[int, float]]:  # noqa: UP006, UP007
        raise NotImplementedError

    def sum(  # pylint: disable=unused-argument
        self,
        table: Table,
        column: Column,
    ) -> any:
        return None

    def mean(  # pylint: disable=unused-argument
        self,
        table: Table,
        column: Column,
    ) -> any:
        return None

    def max(  # pylint: disable=unused-argument
        self,
        table: Table,
        column: Column,
    ) -> any:
        return None

    def min(  # pylint: disable=unused-argument
        self,
        table: Table,
        column: Column,
    ) -> any:
        return None
