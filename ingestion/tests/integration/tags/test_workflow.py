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


@pytest.mark.parametrize("family", ["database", "storage"])
@pytest.mark.parametrize("case", ["fresh", "existing", "denied"])
def test_native_tags_persist_through_workflow(metadata, request, family, case):
    suffix = uuid4().hex[:8]
    service = f"tag_service_{suffix}"
    classification = f"TagClassification_{suffix}"
    server_config = metadata.config.model_copy(deep=True)
    service_type = DatabaseService if family == "database" else StorageService
    workflow = None
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

        if family == "database":
            connection = {**request.getfixturevalue("tagged_postgres"), "classificationName": classification}
            source_type = "postgres"
            source_config = {
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
            asset_type = Table
            expected_assets = {
                f"{service}.demo_db.{schema}.my_table": ["Shared"] if case == "denied" else ["New", "Shared"]
                for schema in ("schema_a", "schema_b")
            }
        else:
            client, connection = request.getfixturevalue("tagged_s3")
            source_type = "s3"
            source_config = {"type": "StorageMetadata", "includeTags": True, "markDeletedContainers": False}
            expected_assets = {}
            for bucket in connection["bucketNames"]:
                client.put_bucket_tagging(
                    Bucket=bucket, Tagging={"TagSet": [{"Key": classification, "Value": "Shared"}]}
                )
                client.put_object_tagging(
                    Bucket=bucket, Key="my_file.txt", Tagging={"TagSet": [{"Key": classification, "Value": "New"}]}
                )
                expected_assets[f"{service}.{bucket}"] = ["Shared"]
                expected_assets[f'{service}.{bucket}."my_file.txt"'] = [] if case == "denied" else ["New"]
            asset_type = Container

        workflow = MetadataWorkflow.create(
            {
                "source": {
                    "type": source_type,
                    "serviceName": service,
                    "serviceConnection": {"config": connection},
                    "sourceConfig": {"config": source_config},
                },
                "sink": {"type": "metadata-rest", "config": {"bulk_sink_batch_size": 1}},
                "workflowConfig": {"loggerLevel": "WARN", "openMetadataServerConfig": server_config},
            }
        )
        workflow.execute()
        assert workflow.source.get_status().failures == []
        assert len(workflow.steps[0].get_status().failures) == (2 if case == "denied" else 0)
        for asset_fqn, names in expected_assets.items():
            asset = metadata.get_by_name(entity=asset_type, fqn=asset_fqn, fields=["tags"])
            assert asset is not None, asset_fqn
            assert sorted(label.tagFQN.root for label in asset.tags or []) == sorted(
                f"{classification}.{name}" for name in names
            )
        assert metadata.get_by_name(entity=Tag, fqn=f"{classification}.Shared") is not None
        assert (metadata.get_by_name(entity=Tag, fqn=f"{classification}.New") is None) == (case == "denied")
        assert workflow.source.tags_registry.stats()["live_entities"] == 0
    finally:
        if workflow is not None:
            workflow.stop()
        for entity_type, entity_fqn in ((service_type, service), (Classification, classification)):
            entity = metadata.get_by_name(entity=entity_type, fqn=entity_fqn)
            if entity is not None:
                _safe_delete(metadata, entity_type, entity.id, recursive=True, hard_delete=True)
