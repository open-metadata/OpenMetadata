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
    source_name = source_connection.sourceName or source_connection.sourceType or source_connection.name
    config = source_connection.connectionConfiguration or source_connection.configuration or {}
    source_database = config.get("database")
    source_schema = stream.namespace

    if not source_name or source_name.lower() not in [
        AirbyteSource.POSTGRES.value.lower(),
        AirbyteSource.MSSQL.value.lower(),
        AirbyteSource.MYSQL.value.lower(),
        AirbyteSource.MONGODB.value.lower(),
        "postgres",
        "mssql",
        "mysql",
        "mongodb",
    ]:
        logger.warning(
            f"Lineage of airbyte pipeline with source [{source_name}] is not supported yet"
        )
        return None

    if source_name and source_name.lower() in [AirbyteSource.MYSQL.value.lower(), "mysql"]:
        source_schema = source_database
        source_database = None
    elif source_name and source_name.lower() in [AirbyteSource.MONGODB.value.lower(), "mongodb"]:
        source_schema = config.get("database_config", {}).get("database")
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
    destination_name = destination_connection.destinationName or destination_connection.destinationType or destination_connection.name
    config = destination_connection.connectionConfiguration or destination_connection.configuration or {}
    destination_database = config.get("database")
    destination_schema = config.get("schema")

    if not destination_name or destination_name.lower() not in [
        AirbyteDestination.POSTGRES.value.lower(),
        AirbyteDestination.MSSQL.value.lower(),
        AirbyteDestination.MYSQL.value.lower(),
        AirbyteDestination.SNOWFLAKE.value.lower(),
        "postgres",
        "mssql",
        "mysql",
        "snowflake",
    ]:
        logger.warning(
            f"Lineage of airbyte pipeline with destination [{destination_name}] is not supported yet"
        )
        return None

    if destination_name and destination_name.lower() in [AirbyteDestination.MYSQL.value.lower(), "mysql"]:
        destination_schema = destination_database
        destination_database = None

    return TableDetails(
        name=stream.name,
        schema=destination_schema,
        database=destination_database,
    )
