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
"""Metadata ingestion against a live Druid broker, once per supported scheme.

Every test here runs three times -- druid, druid+http and druid+https -- because
create_service_request is parametrised over DruidScheme. The https run goes through
Druid's TLS listener with certificate verification enabled.
"""

from metadata.generated.schema.api.automations.createWorkflow import (
    CreateWorkflowRequest,
)
from metadata.generated.schema.entity.automations.testServiceConnection import (
    TestServiceConnectionRequest,
)
from metadata.generated.schema.entity.automations.workflow import (
    Workflow,
    WorkflowType,
)
from metadata.generated.schema.entity.data.database import Database
from metadata.generated.schema.entity.data.databaseSchema import DatabaseSchema
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.connections.database.druidConnection import (
    DruidType,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    StatusType,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseConnection
from metadata.generated.schema.entity.services.serviceType import ServiceType
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections import get_test_connection_fn
from metadata.workflow.metadata import MetadataWorkflow

# The connection leaves databaseName unset, so the connector falls back to "default".
DEFAULT_DATABASE = "default"


def test_ingest_metadata(
    patch_passwords_for_db_services,
    run_workflow,
    ingestion_config,
    metadata: OpenMetadata,
    db_service,
):
    """Schemas, tables and columns all come back from the broker over the configured scheme."""
    run_workflow(MetadataWorkflow, ingestion_config)

    service_fqn = db_service.fullyQualifiedName.root
    database_fqn = f"{service_fqn}.{DEFAULT_DATABASE}"

    databases = metadata.list_entities(entity=Database, params={"service": service_fqn})
    assert {database.name.root for database in databases.entities} == {DEFAULT_DATABASE}

    schemas = metadata.list_entities(entity=DatabaseSchema, params={"database": database_fqn})
    assert {schema.name.root for schema in schemas.entities} >= {"druid", "sys"}

    tables = metadata.list_entities(entity=Table, params={"databaseSchema": f"{database_fqn}.sys"})
    assert {table.name.root for table in tables.entities} >= {"segments", "servers", "tasks"}

    segments = metadata.get_by_name(entity=Table, fqn=f"{database_fqn}.sys.segments", fields=["columns"])
    assert {column.name.root for column in segments.columns} >= {"segment_id", "datasource", "num_rows"}


def test_connection_workflow(metadata: OpenMetadata, db_service):
    """The Test Connection automation -- what the UI runs before a service is saved."""
    workflow_name = f"test-connection-{db_service.name.root}"
    service_connection = db_service.connection.config

    automation_workflow: Workflow = metadata.create_or_update(
        data=CreateWorkflowRequest(
            name=workflow_name,
            description="Test connection for the Druid integration suite",
            workflowType=WorkflowType.TEST_CONNECTION,
            request=TestServiceConnectionRequest(
                serviceType=ServiceType.Database,
                connectionType=DruidType.Druid.value,
                connection=DatabaseConnection(config=service_connection),
            ),
        )
    )

    try:
        get_test_connection_fn(service_connection)(metadata, automation_workflow=automation_workflow)

        final_workflow: Workflow = metadata.get_by_name(entity=Workflow, fqn=workflow_name)
        assert final_workflow.response.status.value == StatusType.Successful.value
    finally:
        metadata.delete(entity=Workflow, entity_id=str(automation_workflow.id.root), hard_delete=True)
