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
Redshift usage module
"""

# This import verifies that the dependencies are available.
from typing import Iterator, Union

from metadata.generated.schema.entity.services.connections.database.redshiftConnection import (
    RedshiftConnection,
)
from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.metadataIngestion.workflow import WorkflowConfig
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.source.database.usage_source import UsageSource

# pylint: disable=useless-super-delegation
from metadata.utils.logger import ingestion_logger
from metadata.utils.sql_queries import REDSHIFT_SQL_STATEMENT

logger = ingestion_logger()


class RedshiftUsageSource(UsageSource):
    def __init__(self, config: WorkflowSource, metadata_config: WorkflowConfig):
        super().__init__(config, metadata_config)
        self.sql_stmt = REDSHIFT_SQL_STATEMENT
        self._extract_iter: Union[None, Iterator] = None
        self._database = "redshift"

    @classmethod
    def create(cls, config_dict, metadata_config: WorkflowConfig):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: RedshiftConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, RedshiftConnection):
            raise InvalidSourceException(
                f"Expected RedshiftConnection, but got {connection}"
            )
        return cls(config, metadata_config)
