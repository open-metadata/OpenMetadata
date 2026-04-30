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

from typing import List, Optional  # noqa: UP035

from sqlalchemy import Column, Table, text
from sqlalchemy.sql.selectable import CTE

from metadata.generated.schema.entity.data.table import TableData, TableType
from metadata.generated.schema.type.staticSamplingConfig import StaticSamplingConfig
from metadata.sampler.sqlalchemy.sampler import (
    ProfileSampleType,
    SQASampler,
)


class AzureSQLSampler(SQASampler):
    """
    Generates a sample of the data to not
    run the query in the whole table.
    """

    # These types are not supported by pyodbc - it throws
    # an error when trying to fetch data from these columns
    # pyodbc.ProgrammingError: ('ODBC SQL type -151 is not yet supported.  column-index=x  type=-151', 'HY106')
    NOT_COMPUTE_PYODBC = {"SQASGeography", "UndeterminedType"}  # noqa: RUF012

    def set_tablesample(self, static: StaticSamplingConfig, selectable: Table):
        """Set the TABLESAMPLE clause for MSSQL
        Args:
            selectable (Table): _description_
        """
        static = self.sample_config.get_static_config()
        if self.entity.tableType != TableType.View:
            if static and static.profileSampleType == ProfileSampleType.PERCENTAGE:
                return selectable.tablesample(text(f"{static.profileSample or 100} PERCENT"))

            return selectable.tablesample(text(f"{int(static.profileSample or 100 if static else 100)} ROWS"))

        return selectable

    def get_sample_query(self, static: StaticSamplingConfig, *, column=None) -> CTE:
        """Override the base method as ROWS or PERCENT sampling handled through the tablesample clause"""
        selectable = self.set_tablesample(static, self.raw_dataset.__table__)
        rnd = self._base_sample_query(selectable, column).cte(f"{self.get_sampler_table_name()}_rnd")
        query = self.get_client().query(rnd)
        return query.cte(f"{self.get_sampler_table_name()}_sample")

    def fetch_sample_data(self, columns: Optional[List[Column]] = None) -> TableData:  # noqa: UP006, UP045
        sqa_columns = []
        if columns:
            for col in columns:
                if col.type.__class__.__name__ not in self.NOT_COMPUTE_PYODBC:
                    sqa_columns.append(col)  # noqa: PERF401
        return super().fetch_sample_data(sqa_columns or columns)
