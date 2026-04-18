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
Supabase lineage module — delegates to Postgres lineage.
"""
from metadata.ingestion.source.database.postgres.lineage import PostgresLineageSource
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class SupabaseLineageSource(PostgresLineageSource):
    """
    Supabase lineage extraction reuses the Postgres lineage source
    since Supabase exposes the same pg_stat_statements view.
    """
