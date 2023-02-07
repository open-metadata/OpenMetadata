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
import traceback
from typing import Iterable, List, Optional, Tuple

from google import auth
from google.cloud.spanner import Client
from sqlalchemy import inspect
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy_bigquery import BigQueryDialect, _types
from sqlalchemy_bigquery._types import _get_sqla_column_type

from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.table import (
    TableType,
)
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
    GCSCredentialsPath,
    GCSValues,
    MultipleProjectId,
    SingleProjectId,
)
from metadata.ingestion.api.source import InvalidSourceException
from metadata.ingestion.source.connections import get_connection
from metadata.ingestion.source.database.column_type_parser import create_sqlalchemy_type
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.utils import fqn
from metadata.utils.filters import filter_by_database
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()
GEOGRAPHY = create_sqlalchemy_type("GEOGRAPHY")
_types._type_map["GEOGRAPHY"] = GEOGRAPHY  # pylint: disable=protected-access


def get_columns(bq_schema):
    """
    get_columns method overwritten to include tag details
    """
    col_list = []
    for field in bq_schema:
        col_obj = {
            "name": field.name,
            "type": _get_sqla_column_type(field),
            "nullable": field.mode in ("NULLABLE", "REPEATED"),
            "comment": field.description,
            "default": None,
            "precision": field.precision,
            "scale": field.scale,
            "max_length": field.max_length,
            "raw_data_type": str(_get_sqla_column_type(field)),
            "policy_tags": None,
        }
        col_list.append(col_obj)
    return col_list


_types.get_columns = get_columns


@staticmethod
def _build_formatted_table_id(table):
    """We overide the methid as it returns both schema and table name if dataset_id is None. From our
    investigation, this method seems to be used only in `_get_table_or_view_names()` of bigquery sqalchemy
    https://github.com/googleapis/python-bigquery-sqlalchemy/blob/2b1f5c464ad2576e4512a0407bb044da4287c65e/sqlalchemy_bigquery/base.py
    """
    return f"{table.table_id}"


BigQueryDialect._build_formatted_table_id = (  # pylint: disable=protected-access
    _build_formatted_table_id
)


class SpannerSource(CommonDbSourceService):
    """
    Implements the necessary methods to extract
    Database metadata from Spanner Source
    """

    def __init__(self, config, metadata_config):
        super().__init__(config, metadata_config)
        self.temp_credentials = None
        self.client = None
        self.project_ids = self.set_project_id()

    @classmethod
    def create(cls, config_dict, metadata_config: OpenMetadataConnection):
        config: WorkflowSource = WorkflowSource.parse_obj(config_dict)
        connection: SpannerConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, SpannerConnection):
            raise InvalidSourceException(
                f"Expected SpannerConnection, but got {connection}"
            )
        return cls(config, metadata_config)

    @staticmethod
    def set_project_id():
        _, project_ids = auth.default()
        return project_ids

    def set_inspector(self, database_name: str):
        self.client = Client(project=database_name)
        if isinstance(self.service_connection.credentials.gcsConfig, GCSValues):
            self.service_connection.credentials.gcsConfig.projectId = SingleProjectId(
                __root__=database_name
            )
        self.engine = get_connection(self.service_connection)
        self.inspector = inspect(self.engine)

    def get_database_names(self) -> Iterable[str]:
        if isinstance(
            self.service_connection.credentials.gcsConfig, GCSCredentialsPath
        ):
            self.set_inspector(database_name=self.project_ids)
            yield self.project_ids
        elif isinstance(
            self.service_connection.credentials.gcsConfig.projectId, SingleProjectId
        ):
            self.set_inspector(database_name=self.project_ids)
            yield self.project_ids
        elif hasattr(
            self.service_connection.credentials.gcsConfig, "projectId"
        ) and isinstance(
            self.service_connection.credentials.gcsConfig.projectId, MultipleProjectId
        ):
            for project_id in self.project_ids:
                database_name = project_id
                database_fqn = fqn.build(
                    self.metadata,
                    entity_type=Database,
                    service_name=self.context.database_service.name.__root__,
                    database_name=database_name,
                )
                if filter_by_database(
                    self.source_config.databaseFilterPattern,
                    database_fqn
                    if self.source_config.useFqnForFiltering
                    else database_name,
                ):
                    self.status.filter(database_fqn, "Database Filtered out")
                    continue

                try:
                    self.set_inspector(database_name=database_name)
                    self.project_id = (  # pylint: disable=attribute-defined-outside-init
                        database_name
                    )
                    yield database_name
                except Exception as exc:
                    logger.debug(traceback.format_exc())
                    logger.error(
                        f"Error trying to connect to database {database_name}: {exc}"
                    )
        else:
            self.set_inspector(database_name=self.project_ids)
            yield self.project_ids

    def get_view_definition(
        self, table_type: str, table_name: str, schema_name: str, inspector: Inspector
    ) -> Optional[str]:
        # NOTE sqlalchemy-spanner doesn't support `get_view_names` yet.
        # SEE https://github.com/googleapis/python-spanner-sqlalchemy/issues/303
        raise NotImplementedError("get_view_definition isn't supported yet.")

    def parse_raw_data_type(self, raw_data_type):
        return raw_data_type.replace(", ", ",").replace(" ", ":").lower()

    def close(self):
        super().close()
        if self.temp_credentials:
            os.unlink(self.temp_credentials)
        os.environ.pop("GOOGLE_CLOUD_PROJECT", "")
