#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Native database and storage tags persisted by real ingestion workflows."""

from contextlib import contextmanager
from uuid import uuid4

import pytest

from metadata.generated.schema.api.classification.createClassification import CreateClassificationRequest
from metadata.generated.schema.api.classification.createTag import CreateTagRequest
from metadata.generated.schema.entity.classification.classification import Classification
from metadata.generated.schema.entity.classification.tag import Tag
from metadata.generated.schema.entity.data.container import Container
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.entity.services.storageService import StorageService
from metadata.workflow.metadata import MetadataWorkflow

from ..conftest import _safe_delete  # noqa: TID252


@contextmanager
def _tag_catalog(metadata, request, case, service_type):
    suffix = uuid4().hex[:8]
    service = f"tag_service_{suffix}"
    classification = f"TagClassification_{suffix}"
    server_config = metadata.config.model_copy(deep=True)
    try:
        assert metadata.get_by_name(entity=Tag, fqn=f"{classification}.Shared") is None
        assert metadata.get_by_name(entity=Tag, fqn=f"{classification}.New") is None
        if case != "fresh":
            metadata.create_or_update(CreateClassificationRequest(name=classification, description="Native test tags"))
            for name in ["Shared", "New"] if case == "existing" else ["Shared"]:
                metadata.create_or_update(
                    CreateTagRequest(name=name, classification=classification, description="Native tag")
                )
        if case == "denied":
            server_config = request.getfixturevalue("tag_writer_without_permissions")

        config = {
            "source": {"serviceName": service},
            "sink": {"type": "metadata-rest", "config": {"bulk_sink_batch_size": 1}},
            "workflowConfig": {"loggerLevel": "WARN", "openMetadataServerConfig": server_config},
        }
        yield config, classification
        assert metadata.get_by_name(entity=Tag, fqn=f"{classification}.Shared") is not None
        assert (metadata.get_by_name(entity=Tag, fqn=f"{classification}.New") is None) == (case == "denied")
    finally:
        for entity_type, entity_fqn in ((service_type, service), (Classification, classification)):
            entity = metadata.get_by_name(entity=entity_type, fqn=entity_fqn)
            if entity is not None:
                _safe_delete(metadata, entity_type, entity.id, recursive=True, hard_delete=True)


def _assert_workflow(metadata, config, asset_type, expected_assets, expected_failures, *, expected_source_failures=0):
    workflow = MetadataWorkflow.create(config)
    try:
        workflow.execute()
        assert len(workflow.source.get_status().failures) == expected_source_failures
        assert len(workflow.steps[0].get_status().failures) == expected_failures
        for asset_fqn, tags in expected_assets.items():
            asset = metadata.get_by_name(entity=asset_type, fqn=asset_fqn, fields=["tags"])
            assert asset is not None, asset_fqn
            assert sorted(label.tagFQN.root for label in asset.tags or []) == sorted(tags)
        assert workflow.source.tags_registry.stats()["live_entities"] == 0
    finally:
        workflow.stop()


@pytest.mark.parametrize("case", ["fresh", "existing", "denied"])
def test_postgres_policy_tags_persist_through_workflow(metadata, request, tagged_postgres, case):
    with _tag_catalog(metadata, request, case, DatabaseService) as (config, classification):
        config["source"].update(
            {
                "type": "postgres",
                "serviceConnection": {"config": {**tagged_postgres, "classificationName": classification}},
                "sourceConfig": {
                    "config": {
                        "type": "DatabaseMetadata",
                        "includeTags": True,
                        "includeViews": False,
                        "includeStoredProcedures": False,
                        "threads": 2 if case == "existing" else 1,
                        "schemaFilterPattern": {"includes": ["^schema_[ab]$"]},
                        "markDeletedTables": False,
                        "markDeletedSchemas": False,
                        "markDeletedStoredProcedures": False,
                    }
                },
            }
        )
        service = config["source"]["serviceName"]
        expected_assets = {
            f"{service}.demo_db.{schema}.my_table": [
                f"{classification}.{name}" for name in (["Shared"] if case == "denied" else ["New", "Shared"])
            ]
            for schema in ("schema_a", "schema_b")
        }
        _assert_workflow(metadata, config, Table, expected_assets, expected_failures=2 if case == "denied" else 0)


@pytest.mark.parametrize("case", ["fresh", "existing", "denied"])
def test_s3_native_tags_persist_through_workflow(metadata, request, tagged_s3, case):
    client, connection = tagged_s3
    with _tag_catalog(metadata, request, case, StorageService) as (config, classification):
        config["source"].update(
            {
                "type": "s3",
                "serviceConnection": {"config": connection},
                "sourceConfig": {
                    "config": {"type": "StorageMetadata", "includeTags": True, "markDeletedContainers": False}
                },
            }
        )
        service = config["source"]["serviceName"]
        expected_assets = {}
        for bucket in connection["bucketNames"]:
            client.put_bucket_tagging(Bucket=bucket, Tagging={"TagSet": [{"Key": classification, "Value": "Shared"}]})
            client.put_object_tagging(
                Bucket=bucket, Key="my_file.txt", Tagging={"TagSet": [{"Key": classification, "Value": "New"}]}
            )
            expected_assets[f"{service}.{bucket}"] = [f"{classification}.Shared"]
            expected_assets[f'{service}.{bucket}."my_file.txt"'] = [] if case == "denied" else [f"{classification}.New"]
        _assert_workflow(metadata, config, Container, expected_assets, expected_failures=2 if case == "denied" else 0)
