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
Utils for Airbyte
"""

from typing import Optional

from metadata.ingestion.source.pipeline.openlineage.models import TableDetails
from metadata.utils.logger import ingestion_logger

from .constants import (  # noqa: TID252
    DESTINATION_TYPE_LOOKUP,
    SOURCE_TYPE_LOOKUP,
    AirbyteDestination,
    AirbyteSource,
)
from .models import AirbyteDestinationResponse, AirbyteSourceResponse, AirbyteStream  # noqa: TID252

logger = ingestion_logger()


def get_source_table_details(stream: AirbyteStream, source_connection: AirbyteSourceResponse) -> Optional[TableDetails]:  # noqa: UP045
    """
    Get the source table details
    """
    source_config = source_connection.resolved_configuration
    source_type = SOURCE_TYPE_LOOKUP.get(source_connection.resolved_type or "")
    source_database = source_config.get("database")
    source_schema = stream.namespace

    if source_type is None:
        logger.warning(
            f"Lineage of airbyte pipeline with source [{source_connection.resolved_type}] is not supported yet"
        )
        return None

    if source_type == AirbyteSource.MYSQL:
        source_schema = source_database
        source_database = None
    elif source_type == AirbyteSource.MONGODB:
        # database_config may be absent or explicitly None on the public-API shape
        source_schema = (source_config.get("database_config") or {}).get("database")
        source_database = None

    return TableDetails(
        name=stream.name,
        schema=source_schema,
        database=source_database,
    )


def get_destination_table_details(
    stream: AirbyteStream, destination_connection: AirbyteDestinationResponse
) -> Optional[TableDetails]:  # noqa: UP045
    """
    Get the destination table details
    """
    destination_config = destination_connection.resolved_configuration
    destination_type = DESTINATION_TYPE_LOOKUP.get(destination_connection.resolved_type or "")
    destination_database = destination_config.get("database")
    destination_schema = destination_config.get("schema")

    if destination_type is None:
        logger.warning(
            f"Lineage of airbyte pipeline with destination [{destination_connection.resolved_type}] is not supported yet"
        )
        return None

    if destination_type == AirbyteDestination.MYSQL:
        destination_schema = destination_database
        destination_database = None

    return TableDetails(
        name=stream.name,
        schema=destination_schema,
        database=destination_database,
    )
