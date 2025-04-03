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
"""PinotDb source module"""
from typing import Iterable, Optional

from pinotdb import sqlalchemy as pinot_sqlalchemy
from sqlalchemy import types

from metadata.generated.schema.entity.services.connections.database.pinotDBConnection import (
    PinotDBConnection,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    Source as WorkflowSource,
)
from metadata.ingestion.api.steps import InvalidSourceException
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.database.common_db_source import CommonDbSourceService


def get_type_custom(data_type, field_size):
    type_map = {
        "int": types.BigInteger,
        "long": types.BigInteger,
        "float": types.Float,
        "double": types.Numeric,
        # BOOLEAN, is added after release 0.7.1.
        # In release 0.7.1 and older releases, BOOLEAN is equivalent to STRING.
        "boolean": types.Boolean,
        "timestamp": types.TIMESTAMP,
        "string": types.String,
        "json": types.JSON,
        "bytes": types.LargeBinary,
        "big_decimal": types.DECIMAL,
        # Complex types
        "struct": types.BLOB,
        "map": types.BLOB,
        "array": types.ARRAY,
    }
    return type_map.get(data_type.lower())


pinot_sqlalchemy.get_type = get_type_custom


class PinotdbSource(CommonDbSourceService):
    """
    Implements the necessary methods to extract
    Database metadata from Oracle Source
    """

    @classmethod
    def create(
        cls, config_dict, metadata: OpenMetadata, pipeline_name: Optional[str] = None
    ):
        config: WorkflowSource = WorkflowSource.model_validate(config_dict)
        connection: PinotDBConnection = config.serviceConnection.root.config
        if not isinstance(connection, PinotDBConnection):
            raise InvalidSourceException(
                f"Expected PinotdbConnection, but got {connection}"
            )
        return cls(config, metadata)

    def get_database_names(self) -> Iterable[str]:
        """
        Default case with a single database.

        It might come informed - or not - from the source.

        Sources with multiple databases should overwrite this and
        apply the necessary filters.
        """
        # TODO: Add databaseDisplayName field in PinotDBConnection
        yield "default"
