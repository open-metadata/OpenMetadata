from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Extra, Field

from metadata.ingestion.models.custom_pydantic import CustomSecretStr
from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.ingestion.source.dashboard.periscope.client import PeriscopeClient
from metadata.ingestion.connections.test_connections import test_connection_steps
from metadata.ingestion.ometa.ometa_api import OpenMetadata


def get_connection(connection: PeriscopeConnection) -> PeriscopeClient:
    """
    Create connection
    """
    return PeriscopeClient(connection)


def test_connection(
    metadata: OpenMetadata,
    client: PeriscopeClient,
    service_connection: PeriscopeConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
) -> None:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """

    def custom_executor():
        return client.get_dashboards_list()

    test_fn = {"GetDashboards": custom_executor}

    test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
    )


class PeriscopeType(Enum):
    Periscope = 'Periscope'

class PeriscopeConnection(BaseModel):
    class Config:
        extra = Extra.forbid

    type: Optional[PeriscopeType] = Field(
        PeriscopeType.Periscope, description='Service Type', title='Service Type'
    )
    cookies: str = Field(
        ...,
        description='Cookies to connect to Periscope. This user should have privileges to read all the metadata in Periscope.',
        title='Cookies',
    )
    client_site_id: str = Field(
        None,
        description='Client Site ID. This is the unique identifier for the Periscope instance.',
        title='Client Site ID',
    )
    supportsMetadataExtraction: Optional[bool] = Field(None, title='Supports Metadata Extraction')
