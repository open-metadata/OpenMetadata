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
Helper module to handle data sampling
for the profiler
"""
from typing import List, Optional

from sqlalchemy import Column, Table, text
from sqlalchemy.orm import Query

from metadata.generated.schema.entity.data.table import TableData, TableType
from metadata.sampler.sqlalchemy.sampler import ProfileSampleType, SQASampler


class AzureSQLSampler(SQASampler):
    """
    Generates a sample of the data to not
    run the query in the whole table.
    """

    # These types are not supported by pyodbc - it throws
    # an error when trying to fetch data from these columns
    # pyodbc.ProgrammingError: ('ODBC SQL type -151 is not yet supported.  column-index=x  type=-151', 'HY106')
    NOT_COMPUTE_PYODBC = {"SQASGeography", "UndeterminedType"}

    def set_tablesample(self, selectable: Table):
        """Set the TABLESAMPLE clause for MSSQL
        Args:
            selectable (Table): _description_
        """
        if self.entity.tableType != TableType.View:
            if self.sample_config.profileSampleType == ProfileSampleType.PERCENTAGE:
                return selectable.tablesample(
                    text(f"{self.sample_config.profileSample or 100} PERCENT")
                )

            return selectable.tablesample(
                text(f"{int(self.sample_config.profileSample or 100)} ROWS")
            )

        return selectable

    def get_sample_query(self, *, column=None) -> Query:
        """get query for sample data"""
        rnd = self._base_sample_query(column).cte(
            f"{self.get_sampler_table_name()}_rnd"
        )
        with self.get_client() as client:
            query = client.query(rnd)
        return query.cte(f"{self.get_sampler_table_name()}_sample")

    def fetch_sample_data(self, columns: Optional[List[Column]] = None) -> TableData:
        sqa_columns = []
        if columns:
            for col in columns:
                if col.type.__class__.__name__ not in self.NOT_COMPUTE_PYODBC:
                    sqa_columns.append(col)
        return super().fetch_sample_data(sqa_columns or columns)
