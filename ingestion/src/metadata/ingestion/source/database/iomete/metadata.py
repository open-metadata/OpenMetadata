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
IOMETE source methods.
"""

import traceback
from typing import Optional

from sqlalchemy.engine.reflection import Inspector

from metadata.generated.schema.entity.data.table import TableType
from metadata.generated.schema.entity.services.connections.database.iometeConnection import (
    IometeConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class IometeSource(CommonDbSourceService):
    """
    IOMETE metadata source. Uses Arrow Flight SQL via adbc_driver_flightsql
    with a custom SQLAlchemy dialect that correctly handles Spark SQL
    SHOW TABLES output (namespace, tableName, isTemporary).
    """

    service_connection: IometeConnection

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config = WorkflowSource.model_validate(config_dict)
        connection: IometeConnection = config.serviceConnection.root.config
        if not isinstance(connection, IometeConnection):
            raise InvalidSourceException(
                f"Expected IometeConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_schema_definition(
        self, table_type: str, table_name: str, schema_name: str, inspector: Inspector
    ) -> Optional[str]:
        try:
            schema_definition = None
            if self.source_config.includeDDL or table_type in (
                TableType.View,
                TableType.MaterializedView,
            ):
                schema_definition = inspector.get_view_definition(
                    table_name, schema_name
                )
            schema_definition = (
                str(schema_definition).strip()
                if schema_definition is not None
                else None
            )
            return schema_definition
        except NotImplementedError:
            logger.warning("Schema definition not implemented")
        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(
                f"Failed to fetch schema definition for {table_name}: {exc}"
            )
        return None
