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
Utils module for the metadata backup and restore process
"""

from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
)
from metadata.ingestion.source.connections import get_connection
from metadata.utils.helpers import BackupRestoreArgs, list_to_dict


def get_engine(common_args: BackupRestoreArgs):
    """
    Get the database connection engine
    """

    connection_options = list_to_dict(common_args.options)
    connection_arguments = list_to_dict(common_args.arguments)

    connection_dict = {
        "hostPort": f"{common_args.host}:{common_args.port}",
        "username": common_args.user,
        "password": common_args.password,
        "connectionOptions": connection_options if connection_options else None,
        "connectionArguments": connection_arguments if connection_arguments else None,
    }

    if not common_args.schema:
        connection_dict["databaseSchema"] = common_args.database
        connection = MysqlConnection(**connection_dict)
    else:
        connection_dict["database"] = common_args.database
        connection = PostgresConnection(**connection_dict)

    engine: Engine = get_connection(connection)

    return engine
