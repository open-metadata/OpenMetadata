#  Copyright 2023 Collate
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
DynamoDB Models
"""
from dataclasses import dataclass
from typing import Dict

from google.cloud.bigtable.row import PartialRowData


@dataclass
class Row:
    def __init__(self, row: PartialRowData):
        self.row = row

    def to_record(self) -> Dict[str, bytes]:
        record = {}
        for cf, cells in self.row.cells.items():
            for column, cell in cells.items():
                record[f"{cf}.{column.decode()}"] = cell[0].value
        record["row_key"] = self.row.row_key
        return record
