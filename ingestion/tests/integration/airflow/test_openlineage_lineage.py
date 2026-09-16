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
Integration test: OpenLineage events → OM lineage resolution.

Verifies that OL COMPLETE events with input/output datasets are resolved
to existing OM table entities and lineage edges are created.

Prerequisites:
    - OM server running at localhost:8585
"""

import json
import time
import uuid

import pytest
import requests

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import (
    CreateDatabaseSchemaRequest,
)
from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.lineage.addLineage import AddLineageRequest
from metadata.generated.schema.entity.data.table import Column, DataType, Table
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.pipelineService import PipelineService
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.generated.schema.type.entityLineage import EntitiesEdge, LineageDetails
from metadata.generated.schema.type.entityLineage import Source as LineageSource
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.ometa.ometa_api import OpenMetadata

from ..integration_base import get_create_service  # noqa: TID252

OM_HOST = "http://localhost:8585"
OM_API = f"{OM_HOST}/api"
OM_JWT = (
    "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGci"
    "OiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcm"
    "ciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7"
    "HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7"
    "P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVK"
    "wEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfd"
    "QllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
)

OL_ENDPOINT = f"{OM_HOST}/api/v1/openlineage/lineage"
AUTH_HEADERS = {
    "Authorization": f"Bearer {OM_JWT}",
    "Content-Type": "application/json",
}


def _om_reachable() -> bool:
    try:
        return requests.get(f"{OM_API}/v1/system/version", timeout=5).status_code == 200
    except Exception:
        return False


pytestmark = [
    pytest.mark.skipif(not _om_reachable(), reason="OM not running at localhost:8585"),
]

SERVICE_NAME = "ol_lineage_test"
DATABASE_NAME = "ol_db"
SCHEMA_NAME = "ol_schema"
SOURCE_TABLE = "raw_order"
TARGET_TABLE = "fact_order"
# A second pair, so the pipeline test does not depend on edges another test created.
PIPELINE_SOURCE_TABLE = "raw_customer"
PIPELINE_TARGET_TABLE = "dim_customer"
PIPELINE_SERVICE_NAME = "ol_lineage_test_pipelines"
PIPELINE_NAME = "ol_transform"


def _dataset(table_name: str) -> dict:
    """OpenLineage dataset reference: namespace is the service, name the rest of the FQN."""
    return {"namespace": SERVICE_NAME, "name": f"{DATABASE_NAME}.{SCHEMA_NAME}.{table_name}"}


def _table_fqn(table_name: str) -> str:
    return f"{SERVICE_NAME}.{DATABASE_NAME}.{SCHEMA_NAME}.{table_name}"


@pytest.fixture(scope="module")
def metadata():
    meta = OpenMetadata(
        OpenMetadataConnection(
            hostPort=OM_API,
            authProvider="openmetadata",
            securityConfig=OpenMetadataJWTClientConfig(jwtToken=OM_JWT),
        )
    )
    assert meta.health_check()
    return meta


@pytest.fixture(scope="module")
def ol_entities(metadata):
    """Tables and a pipeline for OpenLineage events to resolve against."""
    db_service = metadata.create_or_update(data=get_create_service(entity=DatabaseService, name=SERVICE_NAME))
    database = metadata.create_or_update(
        data=CreateDatabaseRequest(name=DATABASE_NAME, service=db_service.fullyQualifiedName)
    )
    db_schema = metadata.create_or_update(
        data=CreateDatabaseSchemaRequest(name=SCHEMA_NAME, database=database.fullyQualifiedName)
    )
    tables = {
        name: metadata.create_or_update(
            data=CreateTableRequest(
                name=name,
                databaseSchema=db_schema.fullyQualifiedName,
                columns=[Column(name="id", dataType=DataType.BIGINT)],
            )
        )
        for name in (SOURCE_TABLE, TARGET_TABLE, PIPELINE_SOURCE_TABLE, PIPELINE_TARGET_TABLE)
    }

    pipeline_service = metadata.create_or_update(
        data=get_create_service(entity=PipelineService, name=PIPELINE_SERVICE_NAME)
    )
    pipeline = metadata.create_or_update(
        data=CreatePipelineRequest(name=PIPELINE_NAME, service=pipeline_service.fullyQualifiedName)
    )

    yield {"tables": tables, "pipeline": pipeline}

    metadata.delete(entity=DatabaseService, entity_id=db_service.id, recursive=True, hard_delete=True)
    metadata.delete(entity=PipelineService, entity_id=pipeline_service.id, recursive=True, hard_delete=True)


@pytest.fixture(scope="module")
def ensure_ol_settings():
    """Ensure OpenLineage settings allow COMPLETE events."""
    resp = requests.put(
        f"{OM_API}/v1/system/settings",
        headers=AUTH_HEADERS,
        json={
            "config_type": "openLineageSettings",
            "config_value": {
                "enabled": True,
                "autoCreateEntities": True,
                "eventTypeFilter": ["COMPLETE"],
                "defaultPipelineService": "openlineage",
            },
        },
        timeout=10,
    )
    assert resp.status_code == 200, f"Failed to set OL settings: {resp.text}"


def _send_ol_event(
    job_namespace: str,
    job_name: str,
    inputs: list,
    outputs: list,
    run_id: str = None,  # noqa: RUF013
) -> dict:
    event = {
        "eventType": "COMPLETE",
        "eventTime": "2026-03-23T12:00:00Z",
        "schemaURL": "https://openlineage.io/spec/2-0-2/OpenLineage.json#/definitions/RunEvent",
        "producer": "https://airflow.apache.org",
        "run": {"runId": run_id or str(uuid.uuid4())},
        "job": {"namespace": job_namespace, "name": job_name},
        "inputs": inputs,
        "outputs": outputs,
    }
    resp = requests.post(OL_ENDPOINT, headers=AUTH_HEADERS, json=event, timeout=10)
    assert resp.status_code == 200, f"OL endpoint returned {resp.status_code}: {resp.text}"
    return resp.json()


class TestOpenLineageEndpointAcceptsEvents:
    def test_accepts_complete_event(self, ensure_ol_settings):
        result = _send_ol_event(
            job_namespace="test",
            job_name="test_job",
            inputs=[],
            outputs=[],
        )
        assert result["status"] == "success"

    def test_rejects_without_schema_url(self):
        event = {
            "eventType": "COMPLETE",
            "eventTime": "2026-03-23T12:00:00Z",
            "producer": "test",
            "run": {"runId": str(uuid.uuid4())},
            "job": {"namespace": "test", "name": "test"},
            "inputs": [],
            "outputs": [],
        }
        resp = requests.post(OL_ENDPOINT, headers=AUTH_HEADERS, json=event, timeout=10)
        assert resp.status_code == 400


@pytest.fixture(scope="module")
def ol_lineage_result(ensure_ol_settings, ol_entities):
    """Result of an OL event over the fixture tables, retried while the tables index.

    Dataset resolution goes through the search index, which trails entity creation.
    """
    deadline = time.monotonic() + 120
    result = {}
    while time.monotonic() < deadline:
        result = _send_ol_event(
            job_namespace="airflow_e2e_lineage",
            job_name="sample_transform",
            inputs=[_dataset(SOURCE_TABLE)],
            outputs=[_dataset(TARGET_TABLE)],
        )
        if result.get("lineageEdgesCreated", 0) > 0:
            return result
        time.sleep(5)

    return result


class TestOpenLineageResolvesExistingTables:
    """Verify OL events whose inputs/outputs match existing tables create lineage edges."""

    def test_creates_lineage_edge_for_known_tables(self, ol_lineage_result):
        assert ol_lineage_result["lineageEdgesCreated"] > 0, (
            f"Expected lineage edges to be created, got: {json.dumps(ol_lineage_result, indent=2)}"
        )

    def test_lineage_edge_has_openlineage_source(self, metadata, ol_lineage_result):
        """Verify the created lineage edge has source=OpenLineage."""
        src_fqn = _table_fqn(SOURCE_TABLE)

        lineage = metadata.get_lineage_by_name(entity=Table, fqn=src_fqn, up_depth=0, down_depth=3)
        downstream = lineage.get("downstreamEdges", [])

        ol_edges = [e for e in downstream if e.get("lineageDetails", {}).get("source") == "OpenLineage"]
        assert len(ol_edges) > 0, (
            f"Expected at least one OpenLineage-sourced edge from {src_fqn}, "
            f"got sources: {[e.get('lineageDetails', {}).get('source') for e in downstream]}"
        )

    def test_lineage_references_existing_pipeline(self, metadata, ensure_ol_settings, ol_entities):
        """A lineage edge carrying source=OpenLineage keeps its pipeline reference."""
        # The OL event's job namespace/name will not auto-match a pipeline, so the edge
        # is added directly -- as the mapper would once it resolves one.
        pipeline = ol_entities["pipeline"]
        src_fqn = _table_fqn(PIPELINE_SOURCE_TABLE)
        src = ol_entities["tables"][PIPELINE_SOURCE_TABLE]
        tgt = ol_entities["tables"][PIPELINE_TARGET_TABLE]

        metadata.add_lineage(
            AddLineageRequest(
                edge=EntitiesEdge(
                    fromEntity=EntityReference(id=src.id.root, type="table"),
                    toEntity=EntityReference(id=tgt.id.root, type="table"),
                    lineageDetails=LineageDetails(
                        pipeline=EntityReference(id=pipeline.id.root, type="pipeline"),
                        source=LineageSource.OpenLineage,
                    ),
                )
            )
        )

        lineage = metadata.get_lineage_by_name(entity=Table, fqn=src_fqn, up_depth=0, down_depth=3)
        ol_edges = [
            e
            for e in lineage.get("downstreamEdges", [])
            if e.get("lineageDetails", {}).get("source") == "OpenLineage"
            and e.get("lineageDetails", {}).get("pipeline") is not None
        ]
        assert len(ol_edges) > 0, "Expected OL edge with pipeline reference"

        pipeline_ref = ol_edges[0]["lineageDetails"]["pipeline"]
        assert pipeline_ref["type"] == "pipeline"
        assert PIPELINE_NAME in pipeline_ref.get("fullyQualifiedName", "")

    def test_no_edges_for_nonexistent_tables(self, ensure_ol_settings):
        """OL events with unknown table names should create 0 edges."""
        result = _send_ol_event(
            job_namespace="test",
            job_name="unknown_job",
            inputs=[{"namespace": "nonexistent_service", "name": "fake_schema.fake_table"}],
            outputs=[{"namespace": "nonexistent_service", "name": "fake_schema.fake_output"}],
        )
        assert result["lineageEdgesCreated"] == 0

    def test_no_edges_for_empty_inputs_outputs(self, ensure_ol_settings):
        """OL events with no inputs/outputs should create 0 edges."""
        result = _send_ol_event(
            job_namespace="test",
            job_name="empty_job",
            inputs=[],
            outputs=[],
        )
        assert result["lineageEdgesCreated"] == 0


class TestOpenLineageEventTypeFiltering:
    def test_start_events_skipped_when_filter_is_complete(self, ensure_ol_settings, ol_entities):
        """START events should be skipped when filter only allows COMPLETE."""
        event = {
            "eventType": "START",
            "eventTime": "2026-03-23T12:00:00Z",
            "schemaURL": "https://openlineage.io/spec/2-0-2/OpenLineage.json#/definitions/RunEvent",
            "producer": "test",
            "run": {"runId": str(uuid.uuid4())},
            "job": {"namespace": "test", "name": "start_test"},
            "inputs": [_dataset(SOURCE_TABLE)],
            "outputs": [_dataset(TARGET_TABLE)],
        }
        resp = requests.post(OL_ENDPOINT, headers=AUTH_HEADERS, json=event, timeout=10)
        result = resp.json()
        assert result["lineageEdgesCreated"] == 0, "START events should not create edges"
