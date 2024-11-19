#  Copyright 2021 Collate
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
Helper module to handle data sampling
for the profiler
"""
from typing import List, Optional

from sqlalchemy import Column

from metadata.generated.schema.entity.data.table import TableData
from metadata.sampler.sqlalchemy.sampler import SQASampler


class AzureSQLSampler(SQASampler):
    """
    Generates a sample of the data to not
    run the query in the whole table.
    """

    # These types are not supported by pyodbc - it throws
    # an error when trying to fetch data from these columns
    # pyodbc.ProgrammingError: ('ODBC SQL type -151 is not yet supported.  column-index=x  type=-151', 'HY106')
    NOT_COMPUTE_PYODBC = {"SQASGeography", "UndeterminedType"}

    def fetch_sample_data(self, columns: Optional[List[Column]] = None) -> TableData:
        sqa_columns = []
        if columns:
            for col in columns:
                if col.type.__class__.__name__ not in self.NOT_COMPUTE_PYODBC:
                    sqa_columns.append(col)
        return super().fetch_sample_data(sqa_columns or columns)
