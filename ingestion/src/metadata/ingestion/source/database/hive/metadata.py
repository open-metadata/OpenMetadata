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
Hive source methods.
"""

from typing import Tuple

from pyhive.sqlalchemy_hive import HiveDialect
from sqlalchemy.inspection import inspect

from metadata.generated.schema.entity.services.connections.database.hiveConnection import (
    HiveConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.ingestion.source.database.hive.connection import get_metastore_connection
from metadata.ingestion.source.database.hive.utils import (
    get_columns,
    get_table_comment,
    get_table_names,
    get_table_names_older_versions,
    get_view_definition,
    get_view_names,
    get_view_names_older_versions,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

HiveDialect.get_columns = get_columns
HiveDialect.get_table_comment = get_table_comment


HIVE_VERSION_WITH_VIEW_SUPPORT = "2.2.0"


class HiveSource(CommonDbSourceService):
    """
    Implements the necessary methods to extract
    Database metadata from Hive Source
    """

    service_connection: HiveConnection

    @classmethod
    def create(cls, config_dict, metadata: OpenMetadata):
        config = WorkflowSource.parse_obj(config_dict)
        connection: HiveConnection = config.serviceConnection.__root__.config
        if not isinstance(connection, HiveConnection):
            raise InvalidSourceException(
                f"Expected HiveConnection, but got {connection}"
            )
        return cls(config, metadata)

    def _parse_version(self, version: str) -> Tuple:
        if "-" in version:
            version = version.replace("-", ".")
        return tuple(map(int, (version.split(".")[:3])))

    def prepare(self):
        """
        Based on the version of hive update the get_table_names method
        Fetching views in hive server with query "SHOW VIEWS" was possible
        only after hive 2.2.0 version
        """
        if not self.service_connection.metastoreConnection:
            result = dict(self.engine.execute("SELECT VERSION()").fetchone())

            version = result.get("_c0", "").split()
            if version and self._parse_version(version[0]) >= self._parse_version(
                HIVE_VERSION_WITH_VIEW_SUPPORT
            ):
                HiveDialect.get_table_names = get_table_names
                HiveDialect.get_view_names = get_view_names
                HiveDialect.get_view_definition = get_view_definition
            else:
                HiveDialect.get_table_names = get_table_names_older_versions
                HiveDialect.get_view_names = get_view_names_older_versions
        else:
            self.engine = get_metastore_connection(
                self.service_connection.metastoreConnection
            )
        self.inspector = inspect(self.engine)
