from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
    MysqlConnection,
)
from metadata.generated.schema.entity.services.connections.database.postgresConnection import (
    PostgresConnection,
)
from metadata.utils.connections import get_connection
from metadata.utils.helpers import list_to_dict


def get_engine(host, port, user, password, options, arguments, schema, database):

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
