#  Copyright 2025 Collate
#  Licensed under the Collate License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Integration tests for the Kestra pipeline connector.

Requires:
  - A running OpenMetadata instance at http://localhost:8585
  - Docker available for testcontainers

Run with:
  pytest ingestion/tests/integration/kestra/test_kestra_integration.py -v -m integration
"""
import json
import time

import pytest
import requests

from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.pipelineService import PipelineService
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.workflow.ingestion import IngestionWorkflow

from ..integration_base import METADATA_INGESTION_CONFIG_TEMPLATE

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

OM_HOST_PORT = "http://localhost:8585/api"
OM_JWT = (
    "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9"
    ".eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0"
    "NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0"
    "mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_"
    "fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8"
    "JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493"
    "VanKpUAfzIiOiIbhg"
)

KESTRA_SERVICE_NAME = "kestra_integration_test"
KESTRA_NAMESPACE = "io.kestra.test"
KESTRA_FLOW_ID = "integration-test-flow"
KESTRA_LINEAGE_FLOW_ID = "lineage-test-flow"
KESTRA_PORT = 8080
KESTRA_HEALTH_TIMEOUT = 120  # seconds to wait for Kestra to be ready
EXECUTION_TIMEOUT = 30  # seconds to wait for execution to reach terminal state


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_om_client() -> OpenMetadata:
    """Return an OpenMetadata client using the standard dev JWT token."""
    server_config = OpenMetadataConnection(
        hostPort=OM_HOST_PORT,
        authProvider="openmetadata",
        securityConfig=OpenMetadataJWTClientConfig(jwtToken=OM_JWT),
    )
    return OpenMetadata(server_config)


def _wait_for_kestra(base_url: str, timeout: int = KESTRA_HEALTH_TIMEOUT) -> None:
    """Poll Kestra's flow search endpoint until it returns HTTP 200."""
    deadline = time.time() + timeout
    last_exc = None
    while time.time() < deadline:
        try:
            resp = requests.get(
                f"{base_url}/api/v1/flows/search?q=*", timeout=5
            )
            if resp.status_code == 200:
                return
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
        time.sleep(3)
    raise RuntimeError(
        f"Kestra did not become healthy within {timeout}s. "
        f"Last error: {last_exc}"
    )


def _run_ingestion(host: str, port: int, source_config: dict | None = None) -> None:
    """Build and execute an IngestionWorkflow against the Kestra container."""
    if source_config is None:
        source_config = {"type": "PipelineMetadata"}

    service_config = json.dumps(
        {"type": "Kestra", "hostPort": f"http://{host}:{port}"}
    )
    config_str = METADATA_INGESTION_CONFIG_TEMPLATE.format(
        type="kestra",
        service_name=KESTRA_SERVICE_NAME,
        service_config=service_config,
        source_config=json.dumps(source_config),
    )
    workflow = IngestionWorkflow.create(json.loads(config_str))
    workflow.execute()
    workflow.raise_from_status()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def kestra_container():
    """
    Start a Kestra standalone container and yield (host, port).

    Skips the entire module if Docker is unavailable.
    """
    try:
        from testcontainers.core.container import DockerContainer
    except ImportError:
        pytest.skip("testcontainers is not installed")

    try:
        container = (
            DockerContainer("kestra/kestra:latest")
            .with_command("server standalone --worker-thread 128")
            .with_exposed_ports(KESTRA_PORT)
        )
        container.start()
    except Exception as exc:  # noqa: BLE001
        pytest.skip(f"Docker is not available or container failed to start: {exc}")

    host = container.get_container_host_ip()
    port = int(container.get_exposed_port(KESTRA_PORT))
    base_url = f"http://{host}:{port}"

    try:
        _wait_for_kestra(base_url)
    except RuntimeError as exc:
        container.stop()
        pytest.skip(str(exc))

    yield host, port

    container.stop()


@pytest.fixture(scope="module", autouse=True)
def cleanup_kestra_service():
    """Delete the Kestra pipeline service from OpenMetadata after the module."""
    yield
    metadata = _build_om_client()
    service = metadata.get_by_name(entity=PipelineService, fqn=KESTRA_SERVICE_NAME)
    if service:
        metadata.delete(
            entity=PipelineService,
            entity_id=service.id,
            recursive=True,
            hard_delete=True,
        )


@pytest.fixture(scope="module")
def metadata_client() -> OpenMetadata:
    """Return an OpenMetadata client for assertions."""
    return _build_om_client()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.integration
def test_pipeline_ingestion(kestra_container, metadata_client):
    """
    Seed a Kestra flow, run ingestion, and assert the Pipeline entity exists
    in OpenMetadata with the expected name and at least 2 tasks.

    Requirements: 11.3, 11.4
    """
    host, port = kestra_container
    base_url = f"http://{host}:{port}"

    # Seed the flow
    flow_payload = {
        "id": KESTRA_FLOW_ID,
        "namespace": KESTRA_NAMESPACE,
        "tasks": [
            {
                "id": "task-1",
                "type": "io.kestra.core.tasks.log.Log",
                "message": "hello",
            },
            {
                "id": "task-2",
                "type": "io.kestra.core.tasks.log.Log",
                "message": "world",
            },
        ],
    }
    resp = requests.post(
        f"{base_url}/api/v1/flows",
        json=flow_payload,
        headers={"Content-Type": "application/json"},
        timeout=10,
    )
    assert resp.status_code in (200, 201, 409), (
        f"Failed to create Kestra flow: {resp.status_code} {resp.text}"
    )

    # Run ingestion
    _run_ingestion(host, port)

    # Assert Pipeline entity exists
    expected_fqn = f"{KESTRA_SERVICE_NAME}.{KESTRA_NAMESPACE}.{KESTRA_FLOW_ID}"
    pipeline: Pipeline = metadata_client.get_by_name(
        entity=Pipeline,
        fqn=expected_fqn,
        fields=["tasks"],
    )
    assert pipeline is not None, (
        f"Pipeline '{expected_fqn}' was not found in OpenMetadata after ingestion"
    )
    assert pipeline.tasks is not None and len(pipeline.tasks) >= 2, (
        f"Expected at least 2 tasks, got: {pipeline.tasks}"
    )


@pytest.mark.integration
def test_execution_status_ingestion(kestra_container, metadata_client):
    """
    Trigger a Kestra execution, wait for it to reach a terminal state,
    re-run ingestion, and assert PipelineStatus records exist.

    Requirements: 11.5
    """
    host, port = kestra_container
    base_url = f"http://{host}:{port}"

    # Trigger an execution
    resp = requests.post(
        f"{base_url}/api/v1/executions/{KESTRA_NAMESPACE}/{KESTRA_FLOW_ID}",
        timeout=10,
    )
    assert resp.status_code in (200, 201), (
        f"Failed to trigger execution: {resp.status_code} {resp.text}"
    )

    # Wait for the execution to reach a terminal state
    terminal_states = {"SUCCESS", "FAILED", "KILLED", "WARNING"}
    deadline = time.time() + EXECUTION_TIMEOUT
    execution_state = None
    while time.time() < deadline:
        exec_resp = requests.get(
            f"{base_url}/api/v1/executions/{KESTRA_NAMESPACE}/{KESTRA_FLOW_ID}",
            timeout=10,
        )
        if exec_resp.status_code == 200:
            data = exec_resp.json()
            results = data.get("results", data) if isinstance(data, dict) else data
            if isinstance(results, list) and results:
                execution_state = results[0].get("state", {}).get("current")
                if execution_state in terminal_states:
                    break
        time.sleep(3)

    # Re-run ingestion to pick up execution status
    _run_ingestion(host, port)

    # Assert PipelineStatus records exist
    expected_fqn = f"{KESTRA_SERVICE_NAME}.{KESTRA_NAMESPACE}.{KESTRA_FLOW_ID}"
    pipeline: Pipeline = metadata_client.get_by_name(
        entity=Pipeline,
        fqn=expected_fqn,
        fields=["pipelineStatus"],
    )
    assert pipeline is not None, (
        f"Pipeline '{expected_fqn}' not found after status ingestion"
    )
    # Query the status history endpoint for this pipeline
    status_list = metadata_client.list_pipeline_statuses(
        fqn=expected_fqn,
        start_ts=0,
        end_ts=int(time.time() * 1000),
    )
    assert status_list is not None and len(status_list) > 0, (
        "Expected at least one PipelineStatus record after execution ingestion"
    )


@pytest.mark.integration
def test_lineage_ingestion(kestra_container, metadata_client):
    """
    Pre-create OM table entities, seed a Kestra flow with lineage labels,
    run ingestion, and assert lineage edges exist between the tables and
    the pipeline.

    Requirements: 11.6
    """
    host, port = kestra_container
    base_url = f"http://{host}:{port}"

    # ------------------------------------------------------------------
    # Pre-create OpenMetadata entities
    # ------------------------------------------------------------------
    from metadata.generated.schema.api.data.createDatabase import (
        CreateDatabaseRequest,
    )
    from metadata.generated.schema.api.data.createDatabaseSchema import (
        CreateDatabaseSchemaRequest,
    )
    from metadata.generated.schema.api.data.createTable import CreateTableRequest
    from metadata.generated.schema.api.services.createDatabaseService import (
        CreateDatabaseServiceRequest,
    )
    from metadata.generated.schema.entity.services.connections.database.common.basicAuth import (
        BasicAuth,
    )
    from metadata.generated.schema.entity.services.connections.database.mysqlConnection import (
        MysqlConnection,
    )
    from metadata.generated.schema.entity.services.databaseService import (
        DatabaseConnection,
        DatabaseServiceType,
    )

    db_service_name = "kestra_lineage_test_db_svc"
    db_name = "kestra_lineage_db"
    schema_name = "kestra_lineage_schema"
    source_table_name = "source_table"
    dest_table_name = "dest_table"

    # Database service
    db_service_req = CreateDatabaseServiceRequest(
        name=db_service_name,
        serviceType=DatabaseServiceType.Mysql,
        connection=DatabaseConnection(
            config=MysqlConnection(
                username="user",
                authType=BasicAuth(password="pass"),
                hostPort="http://localhost:3306",
            )
        ),
    )
    db_service_entity = metadata_client.create_or_update(data=db_service_req)

    # Database
    db_req = CreateDatabaseRequest(
        name=db_name,
        service=db_service_entity.fullyQualifiedName,
    )
    db_entity = metadata_client.create_or_update(data=db_req)

    # Schema
    schema_req = CreateDatabaseSchemaRequest(
        name=schema_name,
        database=db_entity.fullyQualifiedName,
    )
    schema_entity = metadata_client.create_or_update(data=schema_req)

    # Tables
    cols = [Column(name="id", dataType=DataType.BIGINT)]
    source_table_req = CreateTableRequest(
        name=source_table_name,
        databaseSchema=schema_entity.fullyQualifiedName,
        columns=cols,
    )
    dest_table_req = CreateTableRequest(
        name=dest_table_name,
        databaseSchema=schema_entity.fullyQualifiedName,
        columns=cols,
    )
    source_table_entity = metadata_client.create_or_update(data=source_table_req)
    dest_table_entity = metadata_client.create_or_update(data=dest_table_req)

    source_fqn = source_table_entity.fullyQualifiedName.root
    dest_fqn = dest_table_entity.fullyQualifiedName.root

    try:
        # ------------------------------------------------------------------
        # Seed a Kestra flow with lineage labels
        # ------------------------------------------------------------------
        lineage_flow_payload = {
            "id": KESTRA_LINEAGE_FLOW_ID,
            "namespace": KESTRA_NAMESPACE,
            "labels": [
                {"key": "openmetadata.table.input", "value": source_fqn},
                {"key": "openmetadata.table.output", "value": dest_fqn},
            ],
            "tasks": [
                {
                    "id": "task-1",
                    "type": "io.kestra.core.tasks.log.Log",
                    "message": "lineage",
                }
            ],
        }
        resp = requests.post(
            f"{base_url}/api/v1/flows",
            json=lineage_flow_payload,
            headers={"Content-Type": "application/json"},
            timeout=10,
        )
        assert resp.status_code in (200, 201, 409), (
            f"Failed to create lineage Kestra flow: {resp.status_code} {resp.text}"
        )

        # ------------------------------------------------------------------
        # Run ingestion with lineage information
        # ------------------------------------------------------------------
        source_config = {
            "type": "PipelineMetadata",
            "lineageInformation": {
                "dbServiceNames": [db_service_name],
            },
        }
        _run_ingestion(host, port, source_config=source_config)

        # ------------------------------------------------------------------
        # Assert lineage edges exist
        # ------------------------------------------------------------------
        # Check lineage from the source table perspective
        lineage = metadata_client.get_lineage_by_name(
            entity=Table,
            fqn=source_fqn,
        )
        assert lineage is not None, "No lineage data returned for source table"

        downstream_edges = lineage.get("downstreamEdges") or []
        assert len(downstream_edges) > 0, (
            f"Expected downstream lineage edges from '{source_fqn}', got none"
        )

        # Verify the pipeline is referenced in the lineage details
        pipeline_fqn = (
            f"{KESTRA_SERVICE_NAME}.{KESTRA_NAMESPACE}.{KESTRA_LINEAGE_FLOW_ID}"
        )
        pipeline_referenced = any(
            edge.get("lineageDetails", {}).get("pipeline", {}).get(
                "fullyQualifiedName"
            ) == pipeline_fqn
            for edge in downstream_edges
        )
        assert pipeline_referenced, (
            f"Pipeline '{pipeline_fqn}' not found in lineage edges: {downstream_edges}"
        )

    finally:
        # Clean up the database service and all child entities
        db_svc = metadata_client.get_by_name(
            entity=DatabaseService, fqn=db_service_name
        )
        if db_svc:
            metadata_client.delete(
                entity=DatabaseService,
                entity_id=db_svc.id,
                recursive=True,
                hard_delete=True,
            )
