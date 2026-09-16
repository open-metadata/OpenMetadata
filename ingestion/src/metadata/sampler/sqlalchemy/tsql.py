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
Sampling helpers shared by the T-SQL engines (MSSQL, AzureSQL)
"""

from sqlalchemy import text

from metadata.generated.schema.entity.data.table import Table as TableEntity

TEMPORAL_PERIOD_COLUMNS_QUERY = text(
    "SELECT c.name FROM sys.columns c"
    " JOIN sys.tables t ON c.object_id = t.object_id"
    " JOIN sys.schemas s ON t.schema_id = s.schema_id"
    " WHERE t.name = :table_name"
    " AND s.name = :schema_name"
    " AND c.generated_always_type IN (1, 2)"
)


def get_temporal_column_names(sampler) -> frozenset:
    """Return the SYSTEM_TIME period column names of the sampled table, empty if it has none."""
    entity = sampler.entity
    schema_name = entity.databaseSchema.name if isinstance(entity, TableEntity) and entity.databaseSchema else "dbo"
    with sampler.session_factory() as session:
        rows = session.execute(
            TEMPORAL_PERIOD_COLUMNS_QUERY,
            {"table_name": entity.name.root, "schema_name": schema_name},
        ).fetchall()
    return frozenset(row[0] for row in rows)
