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
Databricks Query parser module
"""
from abc import ABC

from metadata.clients.databricks_client import DatabricksClient
from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.common_db_source import SQLSourceStatus
from metadata.ingestion.source.database.query_parser_source import QueryParserSource
from metadata.utils.helpers import get_start_and_end
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class DatabricksQueryParserSource(QueryParserSource, ABC):
    """
    Databricks base for Usage and Lineage
    """

    filters: str

    def __init__(
        self, config: WorkflowSource, metadata_config: OpenMetadataConnection
    ):  # pylint: disable=super-init-not-called
        self.config = config
        self.metadata_config = metadata_config
        self.metadata = OpenMetadata(metadata_config)
        self.connection = self.config.serviceConnection.__root__.config
        self.source_config = self.config.sourceConfig.config
        self.start, self.end = get_start_and_end(self.source_config.queryLogDuration)
        self.report = SQLSourceStatus()
        self.client = DatabricksClient(self.connection)

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        """Create class instance"""
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: DatabricksConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, DatabricksConnection):
            raise InvalidSourceException(
                f"Expected DatabricksConnection, but got {connection}"
            )
        return cls(config, metadata_config)
