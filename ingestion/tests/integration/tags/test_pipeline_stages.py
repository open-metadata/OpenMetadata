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
"""Pipeline stage publication and attachment lifetimes."""

from types import SimpleNamespace

import pytest

from metadata.generated.schema.entity.services.connections.pipeline.airflowConnection import AirflowConnection
from metadata.generated.schema.metadataIngestion.pipelineServiceMetadataPipeline import PipelineServiceMetadataPipeline
from metadata.ingestion.models.topology import TopologyContextManager
from metadata.ingestion.source.pipeline.airflow.api.models import AirflowApiDagDetails
from metadata.ingestion.source.pipeline.airflow.api.source import AirflowApiSource
from metadata.ingestion.source.pipeline.airflow.metadata import AirflowSource
from metadata.ingestion.source.pipeline.airflow.models import AirflowDagDetails
from metadata.utils.tag_utils import get_ometa_tag_and_classification


@pytest.fixture
def source(tag_metadata):
    source = object.__new__(AirflowApiSource)
    source.metadata = tag_metadata
    source.source_config = PipelineServiceMetadataPipeline(includeTags=True)
    source.service_connection = AirflowConnection(
        hostPort="http://localhost:8080",
        connection={"type": "RestAPI", "authConfig": {"username": "admin", "password": "admin"}},
    )
    source.context = TopologyContextManager(source.topology)
    source.context.get().upsert("pipeline_service", "my_service")
    source.pipeline_source_state = set()
    source.connection = SimpleNamespace(api_version="v2")
    return source


def dag(name="my_pipeline", tags=None):
    return AirflowApiDagDetails(dag_id=name, tags=tags if tags is not None else ["Shared"])


def labels(request):
    return [label.tagFQN.root for label in request.tags or []]


def test_definitions_are_published_once_and_labels_stay_scoped(source):
    first = dag(tags=["Shared", "OnlyA"])
    records = list(source.yield_tag_details(first))
    assert [record.right.tag_request.name.root for record in records] == ["Shared", "OnlyA"]
    (request,) = [record.right for record in source.yield_pipeline_details(first)]
    assert labels(request) == ["AirflowTags.Shared", "AirflowTags.OnlyA"]
    assert source.tags_registry.stats()["live_entities"] == 0

    second = dag("other_pipeline", ["Shared", "OnlyB"])
    records = list(source.yield_tag_details(second))
    assert [record.right.tag_request.name.root for record in records] == ["OnlyB"]
    (request,) = [record.right for record in source.yield_pipeline_details(second)]
    assert labels(request) == ["AirflowTags.Shared", "AirflowTags.OnlyB"]
    assert source.tags_registry.stats()["live_entities"] == 0


@pytest.mark.parametrize("finish", ["close", "exhaust"])
def test_pipeline_labels_survive_until_the_request_is_consumed(source, finish):
    details = dag()
    list(source.yield_tag_details(details))
    stream = source.yield_pipeline_details(details)
    request = next(stream).right
    assert labels(request) == ["AirflowTags.Shared"]
    assert source.tags_registry.stats()["live_entities"] == 1
    if finish == "close":
        stream.close()
    else:
        assert list(stream) == []
    assert source.tags_registry.stats()["live_entities"] == 0
    assert labels(request) == ["AirflowTags.Shared"]


def test_interrupted_definition_publication_releases_scope_and_can_retry(source):
    stream = source.yield_tag_details(dag())
    assert next(stream).right.tag_request.name.root == "Shared"
    stream.close()
    assert source.tags_registry.stats()["live_entities"] == 0
    records = list(source.yield_tag_details(dag("other_pipeline")))
    assert [record.right.tag_request.name.root for record in records] == ["Shared"]
    (request,) = [record.right for record in source.yield_pipeline_details(dag("other_pipeline"))]
    assert labels(request) == ["AirflowTags.Shared"]


def test_missing_tag_does_not_prevent_pipeline_creation(source):
    source.metadata.get_by_name.return_value = None
    source.metadata.get_by_name.side_effect = None
    list(source.yield_tag_details(dag()))
    (request,) = [record.right for record in source.yield_pipeline_details(dag())]
    assert request.name.root == "my_pipeline"
    assert labels(request) == []
    assert source.tags_registry.stats()["live_entities"] == 0


def test_disabled_tags_do_not_run_registration_or_lookups(source):
    source.source_config.includeTags = False
    source.metadata.get_by_name.side_effect = AssertionError("Tags disabled")
    assert list(source.yield_tag_details(dag())) == []
    (request,) = [record.right for record in source.yield_pipeline_details(dag())]
    assert request.name.root == "my_pipeline"
    assert labels(request) == []
    assert "tags_registry" not in vars(source)


def test_untagged_pipeline_does_not_create_definition_state(source):
    assert list(source.yield_tag_details(dag(tags=[]))) == []
    assert "tags_registry" not in vars(source)


def test_airflow_database_registers_the_serialized_dags_native_tags(source):
    database_source = object.__new__(AirflowSource)
    vars(database_source).update(vars(source))
    details = AirflowDagDetails(
        dag_id="my_pipeline",
        fileloc="/opt/airflow/dags/my_pipeline.py",
        tasks=[],
        data={"dag": {"fileloc": "/opt/airflow/dags/my_pipeline.py", "tags": ["SerializedTag"]}},
    )
    records = list(database_source.yield_tag_details(details))
    assert [record.right.tag_request.name.root for record in records] == ["SerializedTag"]
    assert [label.tagFQN.root for label in database_source.get_tag_by_fqn("my_service.my_pipeline")] == [
        "AirflowTags.SerializedTag"
    ]


def test_invalid_native_tags_are_skipped_without_losing_valid_labels(source):
    details = dag(tags=[" ", "bad>name", "Shared"])
    records = list(source.yield_tag_details(details))
    assert [record.right.tag_request.name.root for record in records] == ["Shared"]
    (request,) = [record.right for record in source.yield_pipeline_details(details)]
    assert labels(request) == ["AirflowTags.Shared"]


def test_legacy_definition_hook_can_still_publish_without_registry_attachments(source, monkeypatch):
    def legacy_tags(details):
        yield from get_ometa_tag_and_classification(
            tags=details.tags,
            classification_name="LegacyTags",
            tag_description="Native tag",
            classification_description="Native tags",
        )

    monkeypatch.setattr(source, "yield_tag", legacy_tags)
    records = list(source.yield_tag_details(dag()))
    assert [record.right.tag_request.name.root for record in records] == ["Shared"]
    assert records[0].right.tag_request.classification.root == "LegacyTags"
    assert "tags_registry" not in vars(source)
