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
from metadata.utils.connections import get_connection
from metadata.utils.helpers import list_to_dict


# To be fixed in https://github.com/open-metadata/OpenMetadata/issues/8081
# pylint: disable=too-many-arguments
def get_engine(host, port, user, password, options, arguments, schema, database):
    """
    Get the database connection engine
    """

    connection_options = list_to_dict(options)
    connection_arguments = list_to_dict(arguments)

    connection_dict = {
        "hostPort": f"{host}:{port}",
        "username": user,
        "password": password,
        "connectionOptions": connection_options if connection_options else None,
        "connectionArguments": connection_arguments if connection_arguments else None,
    }

    if not schema:
        connection_dict["databaseSchema"] = database
        connection = MysqlConnection(**connection_dict)
    else:
        connection_dict["database"] = database
        connection = PostgresConnection(**connection_dict)

    engine: Engine = get_connection(connection)

    return engine
