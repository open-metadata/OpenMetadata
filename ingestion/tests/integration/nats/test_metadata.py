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
Integration tests for NATS metadata ingestion.

Verifies that NATS JetStream streams are ingested as OpenMetadata Topics
with correct metadata (retention, partitions, config).
"""

import pytest

from metadata.generated.schema.entity.data.topic import Topic
from metadata.workflow.metadata import MetadataWorkflow


def test_streams_ingested_as_topics(run_workflow, ingestion_config, nats_service, nats_streams, metadata):
    run_workflow(MetadataWorkflow, ingestion_config)

    for stream_name in nats_streams:
        topic: Topic = metadata.get_by_name(
            entity=Topic,
            fqn=f"{nats_service.fullyQualifiedName.root}.{stream_name}",
            fields=["*"],
            nullable=False,
        )
        assert topic is not None
        assert topic.name.root == stream_name


def test_crawler_jobs_has_retention(run_workflow, ingestion_config, nats_service, metadata):
    run_workflow(MetadataWorkflow, ingestion_config)

    topic: Topic = metadata.get_by_name(
        entity=Topic,
        fqn=f"{nats_service.fullyQualifiedName.root}.crawler-jobs",
        fields=["*"],
        nullable=False,
    )
    assert topic.retentionTime is not None
    assert topic.retentionTime > 0


@pytest.mark.parametrize("stream_name", ["crawler-jobs", "events"])
def test_topic_service_matches(run_workflow, ingestion_config, nats_service, metadata, stream_name):
    run_workflow(MetadataWorkflow, ingestion_config)

    topic: Topic = metadata.get_by_name(
        entity=Topic,
        fqn=f"{nats_service.fullyQualifiedName.root}.{stream_name}",
        fields=["*"],
        nullable=False,
    )
    assert nats_service.name.root in topic.fullyQualifiedName.root
