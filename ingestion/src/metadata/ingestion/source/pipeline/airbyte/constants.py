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
Constants for Airbyte
"""

from enum import Enum


class AirbyteSource(Enum):
    MYSQL = "MySQL"
    POSTGRES = "Postgres"
    MSSQL = "Microsoft SQL Server (MSSQL)"
    MONGODB = "MongoDb"


class AirbyteDestination(Enum):
    MYSQL = "MySQL"
    POSTGRES = "Postgres"
    MSSQL = "MS SQL Server"


# The internal API reports connector types as display names (e.g. "Postgres"),
# while the public API (`api/public/v1`) reports them as slugs (e.g. "postgres").
# These maps let lineage resolution accept either form.
SOURCE_TYPE_LOOKUP = {
    AirbyteSource.MYSQL.value: AirbyteSource.MYSQL,
    "mysql": AirbyteSource.MYSQL,
    AirbyteSource.POSTGRES.value: AirbyteSource.POSTGRES,
    "postgres": AirbyteSource.POSTGRES,
    AirbyteSource.MSSQL.value: AirbyteSource.MSSQL,
    "mssql": AirbyteSource.MSSQL,
    AirbyteSource.MONGODB.value: AirbyteSource.MONGODB,
    "mongodb": AirbyteSource.MONGODB,
    "mongodb-v2": AirbyteSource.MONGODB,
}

DESTINATION_TYPE_LOOKUP = {
    AirbyteDestination.MYSQL.value: AirbyteDestination.MYSQL,
    "mysql": AirbyteDestination.MYSQL,
    AirbyteDestination.POSTGRES.value: AirbyteDestination.POSTGRES,
    "postgres": AirbyteDestination.POSTGRES,
    AirbyteDestination.MSSQL.value: AirbyteDestination.MSSQL,
    "mssql": AirbyteDestination.MSSQL,
}
