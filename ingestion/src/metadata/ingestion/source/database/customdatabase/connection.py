from typing import Optional

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.database.customDatabaseConnection import (
    CustomDatabaseConnection,
)
from metadata.generated.schema.entity.services.connections.metadata.sasConnection import (
    SASConnection,
)
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.metadata.sas.client import SASClient


def get_connection(connection: CustomDatabaseConnection) -> SASClient:
    sas_connection = SASConnection(
        username=connection.connectionOptions.__root__.get("username"),
        password=connection.connectionOptions.__root__.get("password"),
        serverHost=connection.connectionOptions.__root__.get("serverHost"),
    )
    return SASClient(sas_connection)


def test_connection(
    metadata: OpenMetadata,
    client: SASClient,
    service_connection: CustomDatabaseConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
) -> None:
    test_fn = {"CheckAccess": client.check_connection}
    test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
    )
