#  Copyright 2026 Collate
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
Helper module to handle data sampling for the Oracle profiler
"""

from sqlalchemy import Column
from sqlalchemy.schema import Table
from sqlalchemy.sql.elements import Label
from sqlalchemy.sql.selectable import TableSample

from metadata.sampler.sqlalchemy.sampler import SQASampler


class OracleSampler(SQASampler):
    """Oracle sampler"""

    def _base_sample_query(
        self,
        selectable: Table | TableSample,
        column: Column | None,
        label: Label | None = None,
    ):
        # The percentage sample keeps the rows whose DBMS_RANDOM value is under the threshold,
        # a filter that references no column. When the metric query also counts distinct
        # values, Oracle rewrites the statement and evaluates such a filter once per execution,
        # so the sample holds every row or none. Drawing the value in a query block Oracle does
        # not merge keeps the filter row by row.
        return super()._base_sample_query(selectable, column, label).prefix_with("/*+ NO_MERGE */")
