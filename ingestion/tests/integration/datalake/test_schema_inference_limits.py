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
Issue #29832: a Datalake metadata run with maxSchemaInferenceDepth and maxChildrenPerColumn
stores bounded column trees, shrinks a tree stored by an earlier unbounded run, and keeps the
same entity version on the next run.
"""

import io
import json
import random
from copy import deepcopy

import pytest

from metadata.generated.schema.entity.data.table import Column, Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.utils import fqn
from metadata.workflow.metadata import MetadataWorkflow

from ..conftest import _safe_delete  # noqa: TID252
from ..integration_base import generate_name  # noqa: TID252
from .conftest import INGESTION_CONFIG  # noqa: TID252

LIMITS_BUCKET = "json-limits"
FILE_KEY = "events/part-0.jsonl"
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


def _depth(column: Column) -> int:
    return max((1 + _depth(child) for child in column.children or []), default=0)


def _widest(column: Column) -> int:
    children = column.children or []
    return max([len(children), *(_widest(child) for child in children)])


@pytest.fixture(scope="module")
def limits_bucket(s3_container):
    client = s3_container.get_client()
    if not client.bucket_exists(LIMITS_BUCKET):
        client.make_bucket(LIMITS_BUCKET)
    body = "\n".join(json.dumps(record) for record in _records()).encode()
    client.put_object(LIMITS_BUCKET, FILE_KEY, io.BytesIO(body), length=len(body))
    return LIMITS_BUCKET


@pytest.fixture(scope="module")
def runs(metadata, s3_container, limits_bucket):
    """One unbounded run, then two runs with limits, on the same service."""
    service_name = generate_name().root

    def run(**limits) -> tuple[Table, list[dict]]:
        config = deepcopy(INGESTION_CONFIG)
        source = config["source"]
        source["serviceName"] = service_name
        source["serviceConnection"]["config"]["bucketName"] = limits_bucket
        source["serviceConnection"]["config"]["configSource"]["securityConfig"] = {
            "awsAccessKeyId": s3_container.access_key,
            "awsSecretAccessKey": s3_container.secret_key,
            "awsRegion": "us-west-1",
            "endPointURL": f"http://localhost:{s3_container.get_exposed_port(s3_container.port)}",
        }
        source["sourceConfig"]["config"].update(limits)
        workflow = MetadataWorkflow.create(config)
        workflow.execute()
        workflow.raise_from_status()
        workflow.stop()
        table_fqn = fqn.build(
            metadata,
            entity_type=Table,
            service_name=service_name,
            database_name="default",
            schema_name=limits_bucket,
            table_name=FILE_KEY,
            skip_es_search=True,
        )
        table = metadata.get_by_name(entity=Table, fqn=table_fqn, fields=["columns"], nullable=False)
        return table, list(workflow.source.status.warnings)

    yield {"unbounded": run(), "limited": run(**LIMITS), "limited_again": run(**LIMITS)}

    service = metadata.get_by_name(entity=DatabaseService, fqn=service_name)
    if service:
        _safe_delete(metadata, entity=DatabaseService, entity_id=service.id, recursive=True, hard_delete=True)


def _columns(table: Table) -> dict[str, Column]:
    return {column.name.root: column for column in table.columns}


def test_unbounded_run_stores_the_full_tree(runs):
    table, warnings = runs["unbounded"]

    columns = _columns(table)
    assert len(columns["payload"].children) == 60
    assert _depth(columns["deep"]) == 9
    assert warnings == []


def test_limited_run_shrinks_the_stored_tree(runs):
    table, _ = runs["limited"]

    columns = _columns(table)
    assert {child.name.root for child in columns["payload"].children} == {f"k{n:03d}" for n in range(5)}
    assert all(not grandchild.children for child in columns["payload"].children for grandchild in child.children)
    assert all(_depth(column) <= 2 and _widest(column) <= 5 for column in table.columns)


def test_limited_run_reports_one_warning_for_the_file(runs):
    _, warnings = runs["limited"]

    assert len(warnings) == 1
    message = warnings[0][f"{LIMITS_BUCKET}/{FILE_KEY}"]
    assert "maxChildrenPerColumn=5 cut the children of 1 column(s): payload." in message
    assert "maxSchemaInferenceDepth=2 cut the children of 6 column(s): deep.l1.l2, payload.k000.y" in message


def test_limited_rerun_keeps_the_entity_version(runs):
    limited, _ = runs["limited"]
    limited_again, _ = runs["limited_again"]

    assert limited_again.version == limited.version
    assert limited_again.columns == limited.columns
