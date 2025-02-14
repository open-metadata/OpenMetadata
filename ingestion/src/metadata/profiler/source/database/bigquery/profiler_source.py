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
Bigquery Profiler source
"""

from copy import deepcopy

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.services.connections.database.bigQueryConnection import (
    BigQueryConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.security.credentials.gcpValues import (
    GcpCredentialsValues,
    MultipleProjectId,
    SingleProjectId,
)
from metadata.profiler.source.database.base.profiler_source import ProfilerSource


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
        config_copy: BigQueryConnection = deepcopy(
            config.source.serviceConnection.root.config  # type: ignore
        )

        if isinstance(config_copy.credentials.gcpConfig, GcpCredentialsValues):
            if isinstance(
                config_copy.credentials.gcpConfig.projectId, MultipleProjectId
            ):
                config_copy.credentials.gcpConfig.projectId = SingleProjectId(
                    database.name.root
                )

        return config_copy
