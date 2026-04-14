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

from .constants import AirbyteDestination, AirbyteSource
from .models import AirbyteDestinationResponse, AirbyteSourceResponse, AirbyteStream

logger = ingestion_logger()


def get_source_table_details(
    stream: AirbyteStream, source_connection: AirbyteSourceResponse
) -> Optional[TableDetails]:
    """
    Get the source table details
    """
    source_name = source_connection.sourceName
    source_database = (source_connection.connectionConfiguration or {}).get("database")
    source_schema = stream.namespace

    if source_name not in [
        AirbyteSource.POSTGRES.value,
        AirbyteSource.MSSQL.value,
        AirbyteSource.MYSQL.value,
        AirbyteSource.MONGODB.value,
    ]:
        logger.warning(
            f"Lineage of airbyte pipeline with source [{source_name}] is not supported yet"
        )
        return None

    if source_name == AirbyteSource.MYSQL.value:
        source_schema = source_database
        source_database = None
    elif source_name == AirbyteSource.MONGODB.value:
        source_schema = (
            (source_connection.connectionConfiguration or {})
            .get("database_config", {})
            .get("database")
        )
        source_database = None

    return TableDetails(
        name=stream.name,
        schema=source_schema,
        database=source_database,
    )


def get_destination_table_details(
    stream: AirbyteStream, destination_connection: AirbyteDestinationResponse
) -> Optional[TableDetails]:
    """
    Get the destination table details
    """
    destination_name = destination_connection.destinationName
    destination_database = (destination_connection.connectionConfiguration or {}).get(
        "database"
    )
    destination_schema = (destination_connection.connectionConfiguration or {}).get(
        "schema"
    )

    if destination_name not in [
        AirbyteDestination.POSTGRES.value,
        AirbyteDestination.MSSQL.value,
        AirbyteDestination.MYSQL.value,
    ]:
        logger.warning(
            f"Lineage of airbyte pipeline with destination [{destination_name}] is not supported yet"
        )
        return None

    if destination_name == AirbyteDestination.MYSQL.value:
        destination_schema = destination_database
        destination_database = None

    return TableDetails(
        name=stream.name,
        schema=destination_schema,
        database=destination_database,
    )
