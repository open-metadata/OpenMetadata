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
"""
NoSQL adaptor for the NoSQL profiler.
"""
from abc import ABC, abstractmethod
from typing import Dict, List

from metadata.generated.schema.entity.data.table import Column, Table


class NoSQLAdaptor(ABC):
    @abstractmethod
    def item_count(self, table: Table) -> int:
        raise NotImplementedError

    @abstractmethod
    def scan(
        self, table: Table, columns: List[Column], limit: int
    ) -> List[Dict[str, any]]:
        pass

    def query(
        self, table: Table, columns: List[Column], query: any, limit: int
    ) -> List[Dict[str, any]]:
        raise NotImplementedError
