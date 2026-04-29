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
Unit tests for Redpanda connector — lineage, client, and consumer groups
"""

import uuid
from unittest.mock import MagicMock, patch

import pytest
from requests.exceptions import RequestException

from metadata.generated.schema.entity.data.topic import (
    ConsumerGroup,
    ConsumerGroupMember,
)
from metadata.ingestion.source.messaging.messaging_service import BrokerTopicDetails
from metadata.ingestion.source.messaging.redpanda.client import (
    RedpandaAdminClient,
    RedpandaTransform,
)


class TestRedpandaTransformModel:
    """Test RedpandaTransform Pydantic model"""

    def test_transform_all_fields(self):
        transform = RedpandaTransform(
            name="my-transform",
            input_topic="input-topic",
            output_topics=["output-1", "output-2"],
            status="running",
            environment={"KEY": "value"},
        )
        assert transform.name == "my-transform"
        assert transform.input_topic == "input-topic"
        assert len(transform.output_topics) == 2
        assert transform.status == "running"

    def test_transform_minimal_fields(self):
        transform = RedpandaTransform(
            name="t1",
            input_topic="in",
            output_topics=[],
        )
        assert transform.name == "t1"
        assert transform.status is None
        assert transform.environment is None


class TestRedpandaAdminClient:
    """Test RedpandaAdminClient HTTP calls"""

    @patch("metadata.ingestion.source.messaging.redpanda.client.requests.Session")
    def test_list_transforms_success(self, mock_session_cls):
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session

        mock_response = MagicMock()
        mock_response.json.return_value = [
            {
                "name": "transform-1",
                "input_topic": "events",
                "output_topics": ["processed-events"],
                "status": [{"partition": 0, "status": "running"}],
            },
            {
                "name": "transform-2",
                "input_topic": "logs",
                "output_topics": ["filtered-logs", "error-logs"],
            },
        ]
        mock_response.raise_for_status = MagicMock()
        mock_session.get.return_value = mock_response

        client = RedpandaAdminClient("http://localhost:9644")
        transforms = client.list_transforms()

        assert len(transforms) == 2
        assert transforms[0].name == "transform-1"
        assert transforms[0].input_topic == "events"
        assert transforms[0].output_topics == ["processed-events"]
        assert transforms[1].output_topics == ["filtered-logs", "error-logs"]

    @patch("metadata.ingestion.source.messaging.redpanda.client.requests.Session")
    def test_list_transforms_empty(self, mock_session_cls):
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        mock_response = MagicMock()
        mock_response.json.return_value = []
        mock_response.raise_for_status = MagicMock()
        mock_session.get.return_value = mock_response

        client = RedpandaAdminClient("http://localhost:9644")
        transforms = client.list_transforms()
        assert len(transforms) == 0

    @patch("metadata.ingestion.source.messaging.redpanda.client.requests.Session")
    def test_list_transforms_api_error(self, mock_session_cls):
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        mock_session.get.side_effect = RequestException("Connection refused")

        client = RedpandaAdminClient("http://localhost:9644")
        transforms = client.list_transforms()
        assert len(transforms) == 0

    @patch("metadata.ingestion.source.messaging.redpanda.client.requests.Session")
    def test_default_verify_true(self, mock_session_cls):
        """By default the client verifies server certs against system CAs."""
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        RedpandaAdminClient("http://localhost:9644")
        assert mock_session.verify is True

    @patch("metadata.ingestion.source.messaging.redpanda.client.requests.Session")
    def test_verify_custom_ca_path(self, mock_session_cls):
        """A CA bundle path is propagated to session.verify."""
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        RedpandaAdminClient("https://admin.example:9644", verify="/tmp/ca.pem")
        assert mock_session.verify == "/tmp/ca.pem"

    @patch("metadata.ingestion.source.messaging.redpanda.client.requests.Session")
    def test_client_cert_tuple(self, mock_session_cls):
        """Mutual TLS client cert/key tuple is applied to the session."""
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        RedpandaAdminClient(
            "https://admin.example:9644",
            verify="/tmp/ca.pem",
            client_cert=("/tmp/client.crt", "/tmp/client.key"),
        )
        assert mock_session.cert == ("/tmp/client.crt", "/tmp/client.key")

    @patch("metadata.ingestion.source.messaging.redpanda.client.requests.Session")
    def test_close_releases_session(self, mock_session_cls):
        """close() releases pooled connections by closing the underlying session."""
        mock_session = MagicMock()
        mock_session_cls.return_value = mock_session
        client = RedpandaAdminClient("http://localhost:9644")
        client.close()
        mock_session.close.assert_called_once()


class TestRedpandaTopicLineage:
    """Test Redpanda data transform lineage"""

    @pytest.fixture
    def mock_redpanda_source(self):
        from metadata.ingestion.source.messaging.redpanda.metadata import RedpandaSource

        source = MagicMock(spec=RedpandaSource)
        source.metadata = MagicMock()
        source.context = MagicMock()
        source.context.get.return_value.messaging_service = "test-redpanda-service"
        source.yield_topic_lineage = RedpandaSource.yield_topic_lineage.__get__(source, RedpandaSource)
        return source

    def test_no_admin_client(self, mock_redpanda_source):
        """No lineage when admin client is not configured"""
        mock_redpanda_source.admin_client_rp = None
        topic_details = BrokerTopicDetails(topic_name="test-topic", topic_metadata=MagicMock())
        result = list(mock_redpanda_source.yield_topic_lineage(topic_details))
        assert len(result) == 0

    def test_no_transforms(self, mock_redpanda_source):
        """No lineage when there are no transforms"""
        mock_admin = MagicMock()
        mock_admin.list_transforms.return_value = []
        mock_redpanda_source.admin_client_rp = mock_admin
        mock_redpanda_source._transforms_cache = None

        topic_details = BrokerTopicDetails(topic_name="test-topic", topic_metadata=MagicMock())
        result = list(mock_redpanda_source.yield_topic_lineage(topic_details))
        assert len(result) == 0

    def test_topic_not_input_of_any_transform(self, mock_redpanda_source):
        """No lineage when this topic is not the input of any transform"""
        mock_redpanda_source.admin_client_rp = MagicMock()
        mock_redpanda_source._transforms_cache = {
            "other-topic": [
                RedpandaTransform(
                    name="t1",
                    input_topic="other-topic",
                    output_topics=["output"],
                )
            ]
        }

        topic_details = BrokerTopicDetails(topic_name="test-topic", topic_metadata=MagicMock())
        result = list(mock_redpanda_source.yield_topic_lineage(topic_details))
        assert len(result) == 0

    def test_lineage_success(self, mock_redpanda_source):
        """Lineage created for topic that is input to a transform"""

        source_id = uuid.uuid4()
        target_id = uuid.uuid4()

        mock_source_topic = MagicMock()
        mock_source_topic.id = source_id
        mock_target_topic = MagicMock()
        mock_target_topic.id = target_id

        def get_by_name_side_effect(entity, fqn):
            if "input-topic" in fqn:
                return mock_source_topic
            if "output-topic" in fqn:
                return mock_target_topic
            return None

        mock_redpanda_source.metadata.get_by_name.side_effect = get_by_name_side_effect
        mock_redpanda_source.admin_client_rp = MagicMock()
        mock_redpanda_source._transforms_cache = {
            "input-topic": [
                RedpandaTransform(
                    name="my-transform",
                    input_topic="input-topic",
                    output_topics=["output-topic"],
                )
            ]
        }

        topic_details = BrokerTopicDetails(topic_name="input-topic", topic_metadata=MagicMock())

        with patch("metadata.ingestion.source.messaging.redpanda.metadata.fqn.build") as mock_fqn:
            mock_fqn.side_effect = lambda **kwargs: f"{kwargs['service_name']}.{kwargs['topic_name']}"
            result = list(mock_redpanda_source.yield_topic_lineage(topic_details))

        assert len(result) == 1
        lineage = result[0].right
        assert lineage is not None
        assert lineage.edge.fromEntity.id.root == source_id
        assert lineage.edge.fromEntity.type == "topic"
        assert lineage.edge.toEntity.id.root == target_id
        assert lineage.edge.toEntity.type == "topic"
        assert "my-transform" in lineage.edge.lineageDetails.description

    def test_lineage_multiple_outputs(self, mock_redpanda_source):
        """Lineage created for each output topic of a transform"""
        source_id = uuid.uuid4()
        target1_id = uuid.uuid4()
        target2_id = uuid.uuid4()

        topics_by_name = {
            "input": MagicMock(id=source_id),
            "out1": MagicMock(id=target1_id),
            "out2": MagicMock(id=target2_id),
        }

        def get_by_name_side_effect(entity, fqn):
            for key, mock_topic in topics_by_name.items():
                if key in fqn:
                    return mock_topic
            return None

        mock_redpanda_source.metadata.get_by_name.side_effect = get_by_name_side_effect
        mock_redpanda_source.admin_client_rp = MagicMock()
        mock_redpanda_source._transforms_cache = {
            "input": [
                RedpandaTransform(
                    name="fan-out",
                    input_topic="input",
                    output_topics=["out1", "out2"],
                )
            ]
        }

        topic_details = BrokerTopicDetails(topic_name="input", topic_metadata=MagicMock())

        with patch("metadata.ingestion.source.messaging.redpanda.metadata.fqn.build") as mock_fqn:
            mock_fqn.side_effect = lambda **kwargs: f"svc.{kwargs['topic_name']}"
            result = list(mock_redpanda_source.yield_topic_lineage(topic_details))

        assert len(result) == 2
        assert result[0].right.edge.toEntity.id.root == target1_id
        assert result[1].right.edge.toEntity.id.root == target2_id

    def test_lineage_target_not_found(self, mock_redpanda_source):
        """No lineage when target topic is not found in OpenMetadata"""
        source_id = uuid.uuid4()
        mock_source_topic = MagicMock(id=source_id)

        def get_by_name_side_effect(entity, fqn):
            if "input" in fqn:
                return mock_source_topic
            return None

        mock_redpanda_source.metadata.get_by_name.side_effect = get_by_name_side_effect
        mock_redpanda_source.admin_client_rp = MagicMock()
        mock_redpanda_source._transforms_cache = {
            "input": [
                RedpandaTransform(
                    name="t1",
                    input_topic="input",
                    output_topics=["missing-topic"],
                )
            ]
        }

        topic_details = BrokerTopicDetails(topic_name="input", topic_metadata=MagicMock())

        with patch("metadata.ingestion.source.messaging.redpanda.metadata.fqn.build") as mock_fqn:
            mock_fqn.side_effect = lambda **kwargs: f"svc.{kwargs['topic_name']}"
            result = list(mock_redpanda_source.yield_topic_lineage(topic_details))

        assert len(result) == 0


class TestConsumerGroupModels:
    """Test consumer group Pydantic models"""

    def test_consumer_group_all_fields(self):
        group = ConsumerGroup(
            groupId="my-group",
            state="Stable",
            partitionAssignor="range",
            memberCount=2,
            members=[
                ConsumerGroupMember(
                    memberId="member-1",
                    clientId="client-1",
                    host="/10.0.0.1",
                    assignedPartitions=[0, 1],
                ),
                ConsumerGroupMember(
                    memberId="member-2",
                    clientId="client-2",
                    host="/10.0.0.2",
                    assignedPartitions=[2, 3],
                ),
            ],
            totalLag=150,
        )
        assert group.groupId == "my-group"
        assert group.state.value == "Stable"
        assert group.memberCount == 2
        assert len(group.members) == 2
        assert group.members[0].assignedPartitions == [0, 1]
        assert group.totalLag == 150

    def test_consumer_group_minimal(self):
        group = ConsumerGroup(groupId="minimal-group")
        assert group.groupId == "minimal-group"
        assert group.state is None
        assert group.members is None
        assert group.partitionOffsets is None
        assert group.totalLag is None

    def test_consumer_group_member_minimal(self):
        member = ConsumerGroupMember(memberId="m1")
        assert member.memberId == "m1"
        assert member.clientId is None
        assert member.host is None
        assert member.assignedPartitions is None


class TestConsumerGroupExtraction:
    """Test consumer group extraction in CommonBrokerSource"""

    def test_build_topic_consumer_groups_map(self):
        from metadata.ingestion.source.messaging.common_broker_source import (
            CommonBrokerSource,
        )

        source = MagicMock(spec=CommonBrokerSource)
        source._build_topic_consumer_groups_map = CommonBrokerSource._build_topic_consumer_groups_map.__get__(
            source, CommonBrokerSource
        )
        source._index_group_by_topic = CommonBrokerSource._index_group_by_topic.__get__(source, CommonBrokerSource)
        source._map_consumer_group_state = CommonBrokerSource._map_consumer_group_state

        mock_group_listing = MagicMock()
        mock_group_listing.group_id = "test-group"

        mock_list_result = MagicMock()
        mock_list_result.valid = [mock_group_listing]

        mock_list_future = MagicMock()
        mock_list_future.result.return_value = mock_list_result

        source.admin_client = MagicMock()
        source.admin_client.list_consumer_groups.return_value = mock_list_future

        mock_tp = MagicMock()
        mock_tp.topic = "my-topic"
        mock_tp.partition = 0

        mock_member = MagicMock()
        mock_member.member_id = "member-1"
        mock_member.client_id = "client-1"
        mock_member.host = "/10.0.0.1"
        mock_member.group_instance_id = None
        mock_member.assignment.topic_partitions = [mock_tp]

        mock_state = MagicMock()
        mock_state.name = "STABLE"

        mock_group_desc = MagicMock()
        mock_group_desc.state = mock_state
        mock_group_desc.partition_assignor = "range"
        mock_group_desc.members = [mock_member]

        mock_future = MagicMock()
        mock_future.result.return_value = mock_group_desc

        source.admin_client.describe_consumer_groups.return_value = {"test-group": mock_future}

        result = source._build_topic_consumer_groups_map()

        assert "my-topic" in result
        assert "test-group" in result["my-topic"]
        group_info = result["my-topic"]["test-group"]
        assert group_info["state"] == "Stable"
        assert "member-1" in group_info["members"]

    def test_build_topic_consumer_groups_map_no_groups(self):
        from metadata.ingestion.source.messaging.common_broker_source import (
            CommonBrokerSource,
        )

        source = MagicMock(spec=CommonBrokerSource)
        source._build_topic_consumer_groups_map = CommonBrokerSource._build_topic_consumer_groups_map.__get__(
            source, CommonBrokerSource
        )

        mock_list_result = MagicMock()
        mock_list_result.valid = []
        mock_list_future = MagicMock()
        mock_list_future.result.return_value = mock_list_result
        source.admin_client = MagicMock()
        source.admin_client.list_consumer_groups.return_value = mock_list_future

        result = source._build_topic_consumer_groups_map()
        assert result == {}

    def test_build_topic_consumer_groups_map_skips_members_without_assignment(self):
        """Members with no assignment or empty topic_partitions must not produce entries."""
        from metadata.ingestion.source.messaging.common_broker_source import (
            CommonBrokerSource,
        )

        source = MagicMock(spec=CommonBrokerSource)
        source._build_topic_consumer_groups_map = CommonBrokerSource._build_topic_consumer_groups_map.__get__(
            source, CommonBrokerSource
        )
        source._index_group_by_topic = CommonBrokerSource._index_group_by_topic.__get__(source, CommonBrokerSource)
        source._map_consumer_group_state = CommonBrokerSource._map_consumer_group_state

        mock_list_result = MagicMock()
        mock_list_result.valid = [MagicMock(group_id="empty-group")]
        mock_list_result.errors = []
        mock_list_future = MagicMock()
        mock_list_future.result.return_value = mock_list_result

        source.admin_client = MagicMock()
        source.admin_client.list_consumer_groups.return_value = mock_list_future

        member_no_assignment = MagicMock()
        member_no_assignment.assignment = None

        member_empty_partitions = MagicMock()
        member_empty_partitions.assignment.topic_partitions = []

        mock_group_desc = MagicMock()
        mock_group_desc.state = MagicMock(name="EMPTY")
        mock_group_desc.state.name = "EMPTY"
        mock_group_desc.partition_assignor = ""
        mock_group_desc.members = [member_no_assignment, member_empty_partitions]

        mock_future = MagicMock()
        mock_future.result.return_value = mock_group_desc
        source.admin_client.describe_consumer_groups.return_value = {"empty-group": mock_future}

        result = source._build_topic_consumer_groups_map()
        assert result == {}

    def test_get_consumer_groups_for_topic(self):
        from metadata.ingestion.source.messaging.common_broker_source import (
            CommonBrokerSource,
        )

        source = MagicMock(spec=CommonBrokerSource)
        source._get_consumer_groups_for_topic = CommonBrokerSource._get_consumer_groups_for_topic.__get__(
            source, CommonBrokerSource
        )
        source._topic_consumer_groups = {
            "my-topic": {
                "group-1": {
                    "state": "Stable",
                    "partition_assignor": "range",
                    "members": {
                        "m1": {
                            "client_id": "c1",
                            "host": "/10.0.0.1",
                            "group_instance_id": None,
                            "partitions": [0, 1],
                        }
                    },
                    "offsets": {
                        0: {"current_offset": 50, "end_offset": 100, "lag": 50},
                        1: {"current_offset": 80, "end_offset": 100, "lag": 20},
                    },
                }
            }
        }

        groups = source._get_consumer_groups_for_topic("my-topic")

        assert groups is not None
        assert len(groups) == 1
        assert groups[0].groupId == "group-1"
        assert groups[0].state.value == "Stable"
        assert groups[0].memberCount == 1
        assert groups[0].members[0].memberId == "m1"
        assert groups[0].members[0].assignedPartitions == [0, 1]
        assert groups[0].partitionOffsets is not None
        assert len(groups[0].partitionOffsets) == 2
        assert groups[0].partitionOffsets[0].partition == 0
        assert groups[0].partitionOffsets[0].currentOffset == 50
        assert groups[0].partitionOffsets[0].endOffset == 100
        assert groups[0].partitionOffsets[0].lag == 50
        assert groups[0].totalLag == 70

    def test_get_consumer_groups_for_topic_not_found(self):
        from metadata.ingestion.source.messaging.common_broker_source import (
            CommonBrokerSource,
        )

        source = MagicMock(spec=CommonBrokerSource)
        source._get_consumer_groups_for_topic = CommonBrokerSource._get_consumer_groups_for_topic.__get__(
            source, CommonBrokerSource
        )
        source._topic_consumer_groups = {}

        groups = source._get_consumer_groups_for_topic("unknown-topic")
        assert groups is None

    def test_partition_offsets_are_sorted(self):
        """partitionOffsets must be emitted in ascending partition order."""
        from metadata.ingestion.source.messaging.common_broker_source import (
            CommonBrokerSource,
        )

        source = MagicMock(spec=CommonBrokerSource)
        source._get_consumer_groups_for_topic = CommonBrokerSource._get_consumer_groups_for_topic.__get__(
            source, CommonBrokerSource
        )
        source._topic_consumer_groups = {
            "my-topic": {
                "group-1": {
                    "state": "Stable",
                    "partition_assignor": "range",
                    "members": {},
                    # Intentionally unordered: 3, 0, 2, 1
                    "offsets": {
                        3: {"current_offset": 30, "end_offset": 100, "lag": 70},
                        0: {"current_offset": 10, "end_offset": 100, "lag": 90},
                        2: {"current_offset": 20, "end_offset": 100, "lag": 80},
                        1: {"current_offset": 15, "end_offset": 100, "lag": 85},
                    },
                }
            }
        }

        groups = source._get_consumer_groups_for_topic("my-topic")
        assert groups is not None
        partition_numbers = [po.partition for po in groups[0].partitionOffsets]
        assert partition_numbers == [0, 1, 2, 3]

    def test_consumer_groups_emitted_in_sorted_order(self):
        """Consumer groups on a topic must be emitted in ascending groupId order."""
        from metadata.ingestion.source.messaging.common_broker_source import (
            CommonBrokerSource,
        )

        source = MagicMock(spec=CommonBrokerSource)
        source._get_consumer_groups_for_topic = CommonBrokerSource._get_consumer_groups_for_topic.__get__(
            source, CommonBrokerSource
        )

        def _entry(state="Stable"):
            return {
                "state": state,
                "partition_assignor": "range",
                "members": {},
                "offsets": {},
            }

        # Intentionally unordered insertion: zeta, alpha, mu, beta
        source._topic_consumer_groups = {
            "my-topic": {
                "zeta": _entry(),
                "alpha": _entry(),
                "mu": _entry(),
                "beta": _entry(),
            }
        }

        groups = source._get_consumer_groups_for_topic("my-topic")
        assert groups is not None
        group_ids = [g.groupId for g in groups]
        assert group_ids == ["alpha", "beta", "mu", "zeta"]


class TestBatchEndOffsets:
    """Test batched end-offset fetching in _fetch_consumer_group_offsets"""

    @staticmethod
    def _make_source():
        from metadata.ingestion.source.messaging.common_broker_source import (
            CommonBrokerSource,
        )

        source = MagicMock(spec=CommonBrokerSource)
        source._fetch_consumer_group_offsets = CommonBrokerSource._fetch_consumer_group_offsets.__get__(
            source, CommonBrokerSource
        )
        source._collect_committed_offsets = CommonBrokerSource._collect_committed_offsets.__get__(
            source, CommonBrokerSource
        )
        source._fetch_group_committed_offsets = CommonBrokerSource._fetch_group_committed_offsets.__get__(
            source, CommonBrokerSource
        )
        source._batch_get_end_offsets = CommonBrokerSource._batch_get_end_offsets.__get__(source, CommonBrokerSource)
        return source

    def test_deduplicates_partitions_across_groups(self):
        """Same partition in multiple groups should trigger only one list_offsets call."""
        source = self._make_source()

        mock_tp = MagicMock()
        mock_tp.topic = "shared-topic"
        mock_tp.partition = 0
        mock_tp.offset = 50

        mock_offset_result = MagicMock()
        mock_offset_result.topic_partitions = [mock_tp]

        mock_future = MagicMock()
        mock_future.result.return_value = mock_offset_result

        source.admin_client = MagicMock()
        source.admin_client.list_consumer_group_offsets.return_value = {"key": mock_future}

        topic_cg_map = {
            "shared-topic": {
                "group-A": {
                    "state": "Stable",
                    "partition_assignor": "range",
                    "members": {},
                    "offsets": {},
                },
                "group-B": {
                    "state": "Stable",
                    "partition_assignor": "range",
                    "members": {},
                    "offsets": {},
                },
            }
        }

        mock_end_offset = MagicMock()
        mock_end_offset.offset = 100
        mock_end_future = MagicMock()
        mock_end_future.result.return_value = mock_end_offset

        def mock_list_offsets(tp_spec):
            return dict.fromkeys(tp_spec, mock_end_future)

        source.admin_client.list_offsets.side_effect = mock_list_offsets

        source._fetch_consumer_group_offsets(["group-A", "group-B"], topic_cg_map)

        assert source.admin_client.list_offsets.call_count == 1
        call_args = source.admin_client.list_offsets.call_args[0][0]
        assert len(call_args) == 1

        for group_id in ("group-A", "group-B"):
            offset_data = topic_cg_map["shared-topic"][group_id]["offsets"][0]
            assert offset_data["current_offset"] == 50
            assert offset_data["end_offset"] == 100
            assert offset_data["lag"] == 50

    def test_batches_large_partition_sets(self):
        """Partitions exceeding batch_size should result in multiple list_offsets calls."""
        source = self._make_source()

        committed = {"group-1": {(f"topic-{i}", 0): 10 for i in range(750)}}

        mock_end_offset = MagicMock()
        mock_end_offset.offset = 100
        mock_end_future = MagicMock()
        mock_end_future.result.return_value = mock_end_offset

        def mock_list_offsets(tp_spec):
            return dict.fromkeys(tp_spec, mock_end_future)

        source.admin_client = MagicMock()
        source.admin_client.list_offsets.side_effect = mock_list_offsets

        end_offsets = source._batch_get_end_offsets(committed, batch_size=500)

        assert source.admin_client.list_offsets.call_count == 2
        assert len(end_offsets) == 750
        for offset in end_offsets.values():
            assert offset == 100

    def test_empty_committed_offsets(self):
        """No list_offsets calls when there are no committed offsets."""
        source = self._make_source()
        source.admin_client = MagicMock()

        topic_cg_map = {}
        source._fetch_consumer_group_offsets([], topic_cg_map)

        source.admin_client.list_offsets.assert_not_called()

    def test_end_offset_failure_returns_negative(self):
        """A failed per-partition end-offset lookup is recorded as the sentinel
        ``-1`` in the end_offsets map. Downstream, ``_fetch_consumer_group_offsets``
        translates that sentinel into ``endOffset=None`` and ``lag=None`` on the
        emitted ConsumerGroupPartitionOffset."""
        source = self._make_source()

        committed = {"group-1": {("topic-a", 0): 50}}

        mock_end_future = MagicMock()
        mock_end_future.result.side_effect = Exception("broker timeout")

        def mock_list_offsets(tp_spec):
            return dict.fromkeys(tp_spec, mock_end_future)

        source.admin_client = MagicMock()
        source.admin_client.list_offsets.side_effect = mock_list_offsets

        end_offsets = source._batch_get_end_offsets(committed)

        assert end_offsets[("topic-a", 0)] == -1

    def test_batch_rpc_failure_marks_all_in_chunk(self):
        """If list_offsets itself raises, all partitions in that chunk get -1."""
        source = self._make_source()

        committed = {"group-1": {("topic-a", i): 10 for i in range(3)}}

        source.admin_client = MagicMock()
        source.admin_client.list_offsets.side_effect = Exception("connection lost")

        end_offsets = source._batch_get_end_offsets(committed)

        assert len(end_offsets) == 3
        for offset in end_offsets.values():
            assert offset == -1


class TestCloseCleanup:
    """CommonBrokerSource.close() must clean up SSL temp files."""

    def test_close_cleans_up_ssl_manager(self):
        from metadata.ingestion.source.messaging.common_broker_source import (
            CommonBrokerSource,
        )

        source = MagicMock(spec=CommonBrokerSource)
        source.close = CommonBrokerSource.close.__get__(source, CommonBrokerSource)
        source.generate_sample_data = False
        source.consumer_client = None
        mock_ssl_manager = MagicMock()
        source.ssl_manager = mock_ssl_manager

        source.close()

        mock_ssl_manager.cleanup_temp_files.assert_called_once()

    def test_close_without_ssl_manager_is_a_noop(self):
        from metadata.ingestion.source.messaging.common_broker_source import (
            CommonBrokerSource,
        )

        source = MagicMock(spec=CommonBrokerSource)
        source.close = CommonBrokerSource.close.__get__(source, CommonBrokerSource)
        source.generate_sample_data = False
        source.consumer_client = None
        source.ssl_manager = None

        # Should not raise
        source.close()

    def test_redpanda_close_closes_admin_client(self):
        """RedpandaSource.close() closes admin_client_rp and forwards to super().close()."""
        from metadata.ingestion.source.messaging.redpanda.metadata import RedpandaSource

        source = MagicMock(spec=RedpandaSource)
        source.close = RedpandaSource.close.__get__(source, RedpandaSource)
        # Attributes touched by the inherited CommonBrokerSource.close() body.
        source.generate_sample_data = False
        source.consumer_client = None
        source.ssl_manager = None
        mock_admin = MagicMock()
        source.admin_client_rp = mock_admin

        source.close()

        mock_admin.close.assert_called_once()

    def test_redpanda_close_without_admin_client(self):
        """close() is safe to call when admin_client_rp was never created."""
        from metadata.ingestion.source.messaging.redpanda.metadata import RedpandaSource

        source = MagicMock(spec=RedpandaSource)
        source.close = RedpandaSource.close.__get__(source, RedpandaSource)
        source.generate_sample_data = False
        source.consumer_client = None
        source.ssl_manager = None
        source.admin_client_rp = None

        # Should not raise
        source.close()
