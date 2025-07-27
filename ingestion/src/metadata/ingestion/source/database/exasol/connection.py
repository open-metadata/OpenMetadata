from typing import Optional
from urllib.parse import quote_plus

from pydantic import SecretStr
from sqlalchemy.engine import Engine

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.exasolConnection import (
    ExasolConnection,
)
from metadata.ingestion.connections.builders import (
    create_generic_db_connection,
    get_connection_args_common,
)
from metadata.ingestion.connections.test_connections import test_query
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


def get_connection_url(connection: ExasolConnection) -> str:
    """
    Common method for building the source connection urls
    """

    url = f"{connection.scheme.value}://"

    if connection.username:
        url += f"{quote_plus(connection.username)}"
        connection.password = (
            SecretStr("") if not connection.password else connection.password
        )
        url += (
            f":{quote_plus(connection.password.get_secret_value())}"
            if connection
            else ""
        )
        url += "@"

    url += connection.hostPort

    if hasattr(connection, "databaseSchema"):
        url += f"/{connection.databaseSchema}" if connection.databaseSchema else ""

    tls_settings = {
        "validate-certificate": {},
        "ignore-certificate": {"SSLCertificate": "SSL_VERIFY_NONE"},
        "disable-tls": {"SSLCertificate": "SSL_VERIFY_NONE", "ENCRYPTION": "no"},
    }
    options = tls_settings[connection.tls.value]
    if options:
        if (hasattr(connection, "database") and not connection.database) or (
            hasattr(connection, "databaseSchema") and not connection.databaseSchema
        ):
            url += "/"
        params = "&".join(
            f"{key}={quote_plus(value)}" for (key, value) in options.items() if value
        )
        url = f"{url}?{params}"
    return url


def get_connection(connection: ExasolConnection) -> Engine:
    """
    Create connection
    """
    return create_generic_db_connection(
        connection=connection,
        get_connection_url_fn=get_connection_url,
        get_connection_args_fn=get_connection_args_common,
    )


def test_connection(
    metadata: OpenMetadata,
    engine: Engine,
    service_connection: ExasolConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
) -> None:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """
    test_query(engine, "SELECT 1;")
