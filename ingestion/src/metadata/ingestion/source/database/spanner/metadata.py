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
import os
from typing import Iterable, Optional

from google.cloud.sqlalchemy_spanner import SpannerDialect
from sqlalchemy import inspect
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy_bigquery import BigQueryDialect, _types
from sqlalchemy_bigquery._types import _get_sqla_column_type

from metadata.generated.schema.entity.services.connections.database.spannerConnection import (
    SpannerConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.generated.schema.security.credentials.gcsCredentials import (
    MultipleProjectId,
)
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.source.connections import get_connection
from metadata.ingestion.source.database.column_type_parser import create_sqlalchemy_type
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.utils.credentials import set_google_credentials
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class SpannerSource(CommonDbSourceService):
    """
    Implements the necessary methods to extract
    Database metadata from Spanner Source
    """

    def __init__(self, config, metadata_config):
        super().__init__(config, metadata_config)
        self.temp_credentials = set_google_credentials(
            gcs_credentials=self.service_connection.credentials
        )

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: SpannerConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, SpannerConnection):
            raise InvalidSourceException(
                f"Expected SpannerConnection, but got {connection}"
            )
        if isinstance(connection.credentials.gcsConfig.projectId, MultipleProjectId):
            raise NotImplementedError(
                "The Spanner source doesn't support multiple project IDs."
            )
        return cls(config, metadata_config)

    def set_inspector(self, database_name: str):
        self.engine = get_connection(self.service_connection)
        self.inspector = inspect(self.engine)

    def get_database_names(self) -> Iterable[str]:
        database_name = self.service_connection.instanceId
        yield database_name

    def get_view_definition(
        self, table_type: str, table_name: str, schema_name: str, inspector: Inspector
    ) -> Optional[str]:
        # NOTE sqlalchemy-spanner doesn't support `get_view_names` yet.
        # SEE https://github.com/googleapis/python-spanner-sqlalchemy/issues/303
        raise NotImplementedError("get_view_definition isn't supported yet.")

    def close(self):
        super().close()
        if self.temp_credentials:
            os.unlink(self.temp_credentials)
        os.environ.pop("GOOGLE_CLOUD_PROJECT", "")
