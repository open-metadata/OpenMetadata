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
Source connection handler for Tableau Pipeline
"""

import traceback
from typing import Optional

from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.services.connections.pipeline.tableauPipelineConnection import (
    TableauPipelineConnection,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    TestConnectionResult,
)
from metadata.ingestion.connections.test_connections import (
    SourceConnectionException,
    test_connection_steps,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.dashboard.tableau.connection import (
    build_server_config,
    set_verify_ssl,
)
from metadata.ingestion.source.pipeline.tableaupipeline.client import (
    TableauPipelineClient,
)
from metadata.utils.constants import THREE_MIN
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


def get_connection(connection: TableauPipelineConnection) -> TableauPipelineClient:
    """
    Create connection to Tableau for pipeline extraction.
    """
    tableau_server_auth = build_server_config(connection)
    verify_ssl, ssl_manager = set_verify_ssl(connection)
    try:
        return TableauPipelineClient(
            tableau_server_auth=tableau_server_auth,
            config=connection,
            verify_ssl=verify_ssl,
            ssl_manager=ssl_manager,
        )
    except Exception as exc:
        logger.debug(traceback.format_exc())
        raise SourceConnectionException(
            f"Unknown error connecting with {connection}: {exc}."
        )


def test_connection(
    metadata: OpenMetadata,
    client: TableauPipelineClient,
    service_connection: TableauPipelineConnection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow
    """

    test_fn = {
        "GetPipelines": client.test_get_flows,
        "GetLineage": client.test_metadata_api,
    }

    return test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )
