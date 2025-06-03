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
Bigquery Profiler source
"""

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.profiler.source.database.base.profiler_source import ProfilerSource
from metadata.utils.bigquery_utils import copy_service_config


class BigQueryProfilerSource(ProfilerSource):
    """override the base profiler source to handle BigQuery specific connection configs"""

    def _copy_service_config(
        self, config: OpenMetadataWorkflowConfig, database: Database
    ) -> BigQueryConnection:
        """Make a copy of the database connection config. If MultiProjectId is used, replace it
        with SingleProjectId with the database name being profiled. We iterate over all non filtered
        database in workflow.py `def execute`.

        Args:
            database (Database): a database entity

        Returns:
            DatabaseConnection
        """
        return copy_service_config(config, database.name.root)
