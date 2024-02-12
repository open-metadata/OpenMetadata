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
from typing import Dict, List

from google.cloud.bigtable.row import PartialRowData
from pydantic import BaseModel


class Value(BaseModel):
    timestamp: int
    value: bytes


class Cell(BaseModel):
    values: List[Value]


class Row(BaseModel):
    cells: Dict[str, Dict[bytes, Cell]]
    row_key: bytes

    @classmethod
    def from_partial_row(cls, row: PartialRowData):
        cells = {}
        for cf, cf_cells in row.cells.items():
            if cf not in cells:
                cells[cf] = {}
            for column, cell in cf_cells.items():
                cells[cf][column] = Cell(
                    values=[
                        Value(timestamp=c.timestamp, value=c.value) for c in cell
                    ]
                )
        return cls(cells=cells, row_key=row.row_key)

    def to_record(self) -> Dict[str, bytes]:
        record = {}
        for cf, cells in self.cells.items():
            for column, cell in cells.items():
                # Since each cell can have multiple values and the API returns them in descending order
                # from latest to oldest, we only take the latest value. This probably does not matter since
                # all we care about is data types and all data stored in BigTable is of type `bytes`.
                record[f"{cf}.{column.decode()}"] = cell.values[0].value
        record["row_key"] = self.row_key

        return record
