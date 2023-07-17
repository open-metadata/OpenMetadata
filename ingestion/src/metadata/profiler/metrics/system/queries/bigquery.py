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
Bigquery System Metric Queries
"""
from datetime import datetime

from pydantic import BaseModel

from metadata.profiler.metrics.system.dml_operation import DatabaseDMLOperations


class BigQueryQueryResult(BaseModel):
    table_name: dict
    timestamp: datetime
    query_type: str
    dml_statistics: dict


DML_STAT_TO_DML_STATEMENT_MAPPING = {
    "inserted_row_count": DatabaseDMLOperations.INSERT.value,
    "deleted_row_count": DatabaseDMLOperations.DELETE.value,
    "updated_row_count": DatabaseDMLOperations.UPDATE.value,
}

JOBS = """
    SELECT
        statement_type,
        start_time,
        destination_table,
        dml_statistics
    FROM
        `region-{usage_location}`.INFORMATION_SCHEMA.JOBS
    WHERE
        DATE(creation_time) >= CURRENT_DATE() - 1 AND
        destination_table.dataset_id = '{dataset_id}' AND
        destination_table.project_id = '{project_id}' AND
        statement_type IN (
            '{insert}',
            '{update}',
            '{delete}',
            '{merge}'
        )
    ORDER BY creation_time DESC;
"""
