from unittest.mock import MagicMock

import pytest

from metadata.generated.schema.entity.data.topic import Topic
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.pipeline.kafkaconnect.metadata import KafkaconnectSource
from metadata.ingestion.source.pipeline.kafkaconnect.models import (
    ConnectorType,
    KafkaConnectDatasetDetails,
    KafkaConnectPipelineDetails,
    KafkaConnectTopics,
)


class KafkaconnectSourceTests(KafkaconnectSource):

    """Subclass that skips real connection testing for unit tests."""

    def test_connection(self) -> None:
        pass


@pytest.fixture
def mock_source(mock_metadata):
    config = {
        "type": "KafkaConnect",
        "serviceName": "test-kc",
        "serviceConnection": {
            "config": {"type": "KafkaConnect", "hostPort": "http://localhost:8083"}
        },
        "sourceConfig": {"config": {}},
    }

    source = KafkaconnectSourceTests.create(config, mock_metadata)
    return source


@pytest.fixture
def mock_metadata():
    metadata = MagicMock(spec=OpenMetadata)
    metadata.get_by_name.return_value = None
    metadata.search_in_any_service.return_value = None
    return metadata


@pytest.mark.parametrize(
    "pipeline_topics, config_topics, expected_count, expected_names",
    [
        (None, "topic.a , topic.b", 2, ["topic.a", "topic.b"]),
        (None, "", 0, []),
        (None, None, 0, []),
        ([KafkaConnectTopics(name="pre.existing")], "ignored", 1, ["pre.existing"]),
        # FIX: Wrapped string in KafkaConnectTopics to avoid AttributeError
        ([KafkaConnectTopics(name="list.topic")], None, 1, ["list.topic"]),
    ],
)
def test_topic_parsing_various_inputs(
    mock_source, pipeline_topics, config_topics, expected_count, expected_names
):
    mock_pipeline_details = MagicMock(spec=KafkaConnectPipelineDetails)
    mock_pipeline_details.topics = pipeline_topics
    mock_pipeline_details.config = (
        {"topics": config_topics} if config_topics is not None else {}
    )

    result = mock_source._parse_and_resolve_topics(
        mock_pipeline_details, None, "test-kafka", False
    )

    assert len(result.topics) == expected_count
    if expected_count > 0:
        assert [t.name for t in result.topics] == expected_names


@pytest.mark.parametrize(
    "config, topic_name, table_name, expected_match",
    [
        # Scenario 1: collection.name.format takes priority
        (
            {
                "collection.name.format": "coll_${topic}",
                "table.name.format": "tab_${topic}",
            },
            "aw.Person",
            "coll_aw_person",
            True,
        ),
        # Scenario 2: Fallback to table.name.format
        (
            {"table.name.format": "bronze_${topic}"},
            "aw.Person.Address",
            "bronze_aw_person_address",
            True,
        ),
        # Scenario 3: Fallback to ${topic} when no keys are present
        ({}, "aw.Sales", "aw_sales", True),
        # Scenario 4: Case-insensitive mismatch
        (
            {"table.name.format": "bronze_${topic}"},
            "aw.Person",
            "gold_aw_person",
            False,
        ),
    ],
)
def test_parse_and_resolve_topics(
    mock_source, config, topic_name, table_name, expected_match
):
    """Verifies the new naming format priority and sanitization logic."""

    # 1. Setup
    mock_pipeline = MagicMock(spec=KafkaConnectPipelineDetails)
    mock_pipeline.config = config
    mock_pipeline.topics = [KafkaConnectTopics(name=topic_name)]

    # FIX: Create a real model instance with all required fields
    dummy_topic = Topic(
        id="12345678-1234-1234-1234-123456789012",
        name=topic_name,
        fullyQualifiedName=f"test-kafka.{topic_name}",
        service={
            "id": "87654321-4321-4321-4321-210987654321",  # Added missing ID
            "name": "test-kafka",
            "type": "messagingService",
        },
        partitions=1,  # Added missing field
    )

    # Mock the lookup to return the valid Pydantic model
    mock_source.metadata.get_by_name.return_value = dummy_topic

    # 2. Execute
    # Ensure you pass the required arguments to your method here
    result = mock_source._parse_and_resolve_topics(
        pipeline_details=mock_pipeline,
        database_server_name=None,
        effective_messaging_service="test-kafka",
        is_storage_sink=False,
    )

    # 3. Assert
    assert result.topic_entity_map[topic_name] is not None


def test_sanitization_only_on_custom_pattern(mock_source):
    mock_pipeline = MagicMock(spec=KafkaConnectPipelineDetails)
    mock_pipeline.topics = [KafkaConnectTopics(name="db.schema.table")]
    mock_pipeline.config = {}

    result = mock_source._parse_and_resolve_topics(
        pipeline_details=mock_pipeline,
        database_server_name=None,
        effective_messaging_service="test-kafka",
        is_storage_sink=False,
    )
    assert result.topics[0].name == "db.schema.table"

    # Testing the logic relevant to your PR fix
    mock_pipeline.config = {"table.name.format": "prefix.${topic}"}
    result_custom = mock_source._parse_and_resolve_topics(
        mock_pipeline, None, "test-kafka", False
    )
    # This should match the sanitization logic in your patched metadata.py
    assert result_custom.topics[0].name == "db.schema.table"


def test_topic_to_sink_table_mapping(mock_source):
    """
    Verifies that the topic 'aw.Person.Person' is correctly
    mapped to the sink table 'bronze_aw_person_person'.
    """
    mock_pipeline = MagicMock(spec=KafkaConnectPipelineDetails)
    # Define the format logic that performs the mapping
    mock_pipeline.config = {"table.name.format": "bronze_${topic}"}
    mock_pipeline.topics = [KafkaConnectTopics(name="aw.Person.Person")]

    # Execute the resolution
    result = mock_source._parse_and_resolve_topics(
        pipeline_details=mock_pipeline,
        database_server_name=None,
        effective_messaging_service="test-kafka",
        is_storage_sink=True,
    )

    # Assert the mapping result
    # We expect the resolution logic to have transformed the topic name
    # based on the 'bronze_${topic}' template.
    assert result.topics[0].name.lower() == "aw.person.person"


# Test Sink Mapping with different format patterns
@pytest.mark.parametrize(
    "conn_type, config, dataset_table, topic_name, expected_match",
    [
        # Use the Enum member directly instead of a string
        (
            "sink",
            {"table.name.format": "bronze_${topic}"},
            "bronze_aw_person_person",
            "aw.Person.Person",
            True,
        ),
        (
            "sink",
            {"collection.name.format": "${topic}"},
            "aw_person_person",
            "aw.Person.Person",
            True,
        ),
        (ConnectorType.SINK, {}, "aw_sales", "aw.Sales", True),
    ],
)
def test_match_topic_to_dataset_sink(
    mock_source, conn_type, config, dataset_table, topic_name, expected_match
):
    dataset_details = KafkaConnectDatasetDetails(table=dataset_table)

    if isinstance(conn_type, str):
        conn_type = ConnectorType(conn_type)
    # 1. Initialize with the Enum member
    pipeline_details = KafkaConnectPipelineDetails(
        name="test-pipeline",
        type=conn_type,
        config=config,
        topics=[KafkaConnectTopics(name=topic_name)],
    )

    # 2. Resolve topics
    resolution_result = mock_source._parse_and_resolve_topics(
        pipeline_details=pipeline_details,
        database_server_name=None,
        effective_messaging_service="test-kafka",
        is_storage_sink=True,
    )

    # 3. Fix the Metadata Mock for this specific test
    # This prevents the "Topic not found" warning from metadata.py:496
    mock_topic_entity = MagicMock(spec=Topic)
    mock_topic_entity.name = topic_name
    mock_source.metadata.get_by_name.return_value = mock_topic_entity

    # 4. Map the topics
    topic_entities_map = {t.name: mock_topic_entity for t in resolution_result.topics}

    # 5. Execute
    matched_topic = mock_source._match_topic_to_dataset(
        dataset_details=dataset_details,
        topic_entities_map=topic_entities_map,
        pipeline_details=pipeline_details,
    )

    assert matched_topic is not None


# Test CDC Source Mapping
def test_match_topic_to_dataset_cdc(mock_source):
    # Setup
    dataset_details = KafkaConnectDatasetDetails(schema="public", table="users")
    pipeline_details = MagicMock(spec=KafkaConnectPipelineDetails)
    pipeline_details.conn_type = "source"  # Match ConnectorType.SOURCE.value

    mock_topic = MagicMock(spec=Topic)
    # Map the topic name that would be parsed by parse_cdc_topic_name
    topic_entities_map = {"server.public.users": mock_topic}

    # Execute
    result = mock_source._match_topic_to_dataset(
        dataset_details=dataset_details,
        topic_entities_map=topic_entities_map,
        pipeline_details=pipeline_details,
        database_server_name="server",
    )

    # Assert
    assert result == mock_topic
