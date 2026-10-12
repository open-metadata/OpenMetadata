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
Issue #29832: an S3 storage metadata run with maxSchemaInferenceDepth and maxChildrenPerColumn
stores bounded container data models, shrinks a data model stored by an earlier unbounded run,
and keeps the same container version on the next run.
"""

import io
import json
import random
import uuid

import pytest

from _openmetadata_testutils.ometa import OM_JWT
from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.data.table import Column
from metadata.generated.schema.entity.services.storageService import StorageService
from metadata.workflow.metadata import MetadataWorkflow

LIMITS_BUCKET = "json-limits"
SAMPLE_KEY = "events/part-0.json"
LIMITS = {"maxSchemaInferenceDepth": 2, "maxChildrenPerColumn": 5}


def _records() -> list[dict]:
    """Wide and deep records whose keys arrive in a different order and subset per record."""
    records = []
    for idx in range(20):
        keys = [f"k{n:03d}" for n in range(60)]
        random.Random(idx).shuffle(keys)
        deep: dict = {"leaf": idx}
        for level in range(8, 0, -1):
            deep = {f"l{level}": deep}
        payload = {key: {"x": idx, "y": {"z": idx}} for key in keys[: 50 + idx % 10]}
        records.append({"id": idx, "payload": payload, "deep": deep})
    return records


def _put(client, key: str, body: bytes) -> None:
    client.put_object(LIMITS_BUCKET, key, io.BytesIO(body), length=len(body))


def _depth(column: Column) -> int:
    return max((1 + _depth(child) for child in column.children or []), default=0)


def _widest(column: Column) -> int:
    children = column.children or []
    return max([len(children), *(_widest(child) for child in children)])


@pytest.fixture(scope="module")
def limits_bucket(s3):
    _, client = s3
    if not client.bucket_exists(LIMITS_BUCKET):
        client.make_bucket(LIMITS_BUCKET)
    _put(client, SAMPLE_KEY, json.dumps(_records()).encode())
    manifest = {"entries": [{"dataPath": "events", "structureFormat": "json", "isPartitioned": False}]}
    _put(client, "openmetadata.json", json.dumps(manifest).encode())
    return LIMITS_BUCKET


@pytest.fixture(scope="module")
def runs(metadata, s3, limits_bucket):
    """One unbounded run, then two runs with limits, on the same service."""
    s3_container, _ = s3
    service_name = str(uuid.uuid4())

    def run(**limits) -> tuple[Container, list[dict]]:
        workflow = MetadataWorkflow.create(
            {
                "source": {
                    "type": "s3",
                    "serviceName": service_name,
                    "serviceConnection": {
                        "config": {
                            "type": "S3",
                            "awsConfig": {
                                "awsAccessKeyId": s3_container.access_key,
                                "awsSecretAccessKey": s3_container.secret_key,
                                "awsRegion": "us-east-1",
                                "endPointURL": f"http://localhost:{s3_container.get_exposed_port(9000)}",
                            },
                            "bucketNames": [limits_bucket],
                        }
                    },
                    "sourceConfig": {"config": {"type": "StorageMetadata", **limits}},
                },
                "sink": {"type": "metadata-rest", "config": {}},
                "workflowConfig": {
                    "openMetadataServerConfig": {
                        "hostPort": "http://localhost:8585/api",
                        "authProvider": "openmetadata",
                        "securityConfig": {"jwtToken": OM_JWT},
                    }
                },
            }
        )
        workflow.execute()
        workflow.raise_from_status()
        workflow.stop()
        container = metadata.get_by_name(
            entity=Container, fqn=f"{service_name}.{limits_bucket}.events", fields=["dataModel"], nullable=False
        )
        return container, list(workflow.source.status.warnings)

    yield {"unbounded": run(), "limited": run(**LIMITS), "limited_again": run(**LIMITS)}

    service = metadata.get_by_name(entity=StorageService, fqn=service_name)
    if service:
        metadata.delete(entity=StorageService, entity_id=service.id, hard_delete=True, recursive=True)


def _columns(container: Container) -> dict[str, Column]:
    return {column.name.root: column for column in container.dataModel.columns}


def test_unbounded_run_stores_the_full_tree(runs):
    container, _ = runs["unbounded"]

    columns = _columns(container)
    assert len(columns["payload"].children) == 60
    assert _depth(columns["deep"]) == 9


def test_limited_run_shrinks_the_stored_data_model(runs):
    container, _ = runs["limited"]

    columns = _columns(container)
    assert {child.name.root for child in columns["payload"].children} == {f"k{n:03d}" for n in range(5)}
    assert all(_depth(column) <= 2 and _widest(column) <= 5 for column in container.dataModel.columns)


def test_limited_run_reports_one_warning_for_the_sample_file(runs):
    _, warnings = runs["limited"]

    inference_warnings = [warning for warning in warnings if f"{LIMITS_BUCKET}/{SAMPLE_KEY}" in warning]
    assert len(inference_warnings) == 1
    message = inference_warnings[0][f"{LIMITS_BUCKET}/{SAMPLE_KEY}"]
    assert "maxChildrenPerColumn=5 cut the children of 1 column(s): payload." in message


def test_limited_rerun_keeps_the_container_version(runs):
    limited, _ = runs["limited"]
    limited_again, _ = runs["limited_again"]

    assert limited_again.version == limited.version
    assert limited_again.dataModel.columns == limited.dataModel.columns
