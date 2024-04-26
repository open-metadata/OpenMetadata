from urllib.parse import quote_plus
from sqlalchemy.engine import URL

from metadata.ingestion.connections.sql.builders.helpers import get_connection_options_dict

class SqlAlchemyUrlBuilder:
    def __init__(self, url: URL):
        self._url = url

    @classmethod
    def from_driver(cls, driver: str):
        return cls(url=URL.create(drivername=driver))

    def with_username(self, username):
        self._url = self._url.set(username=username)

    def with_password(self, password):
        self._url = self._url.set(password=password)

    def with_host(self, host):
        self._url = self._url.set(host=host)

    def with_port(self, port):
        self._url = self._url.set(port=port)

    def with_hostport(self, host_port):
        host, port = host_port.split(":")
        self._url = self._url.set(host=host, port=int(port))

    def with_database(self, database):
        self._url = self._url.set(database=database)

    def with_query_params(self, query_params):
        self._url = self._url.update_query_dict(query_params)

    def build(self) -> URL:
        return self._url


# TODO: Move this to a proper place
def handle_password(connection) -> str:
    from metadata.utils.constants import BUILDER_PASSWORD_ATTR
    from metadata.clients.aws_client import AWSClient
    from metadata.generated.schema.entity.services.connections.database.common.iamAuthConfig import (
        IamAuthConfigurationSource,
    )
    from pydantic import SecretStr

    password = getattr(connection, BUILDER_PASSWORD_ATTR, None)

    if not password:
        password = SecretStr("")

        # Check if IamAuth exists - specific to Mysql and Postgres connection.
        if hasattr(connection, "authType"):
            password = getattr(
                connection.authType, BUILDER_PASSWORD_ATTR, SecretStr("")
            )
            if isinstance(connection.authType, IamAuthConfigurationSource):
                # if IAM based, fetch rds client and generate db auth token.
                aws_client = AWSClient(
                    config=connection.authType.awsConfig
                ).get_rds_client()
                host, port = connection.hostPort.split(":")
                password = SecretStr(
                    aws_client.generate_db_auth_token(
                        DBHostname=host,
                        Port=port,
                        DBUsername=connection.username,
                        Region=connection.authType.awsConfig.awsRegion,
                    )
                )
    return password.get_secret_value()

def default_url_builder(connection) -> SqlAlchemyUrlBuilder:
    builder = SqlAlchemyUrlBuilder.from_driver(connection.scheme.value)

    if connection.username:
        builder.with_username(quote_plus(connection.username))
        builder.with_password(handle_password(connection))

    builder.with_hostport(connection.hostPort)

    if hasattr(connection, "database"):
        builder.with_database(connection.database or "")

    elif hasattr(connection, "databaseSchema"):
        builder.with_database(connection.databaseSchema or "")

    builder.with_query_params(get_connection_options_dict(connection) or {})
    return builder
